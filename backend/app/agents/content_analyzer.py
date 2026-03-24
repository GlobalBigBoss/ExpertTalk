import json
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.models.schemas import PersonInfo, SlideContent

logger = logging.getLogger(__name__)

_client = None


def get_client():
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
    return _client


ANALYSIS_PROMPT_TEMPLATE = """你是一个专业的视频内容分析助手。请分析以下英文视频转录文本，完成以下任务：

1. **中文翻译**: 将核心内容翻译成流畅的中文（不需要逐字翻译，保留关键信息和含义，2000-3000字）
2. **核心观点**: 提取10-15个最重要的核心观点，每个观点用2-3句话详细描述
3. **人物识别**: 识别视频中提到的重要人物（不包括主持人/采访者本人），给出英文名、中文名、上下文
4. **PPT大纲**: 生成一个15-25页高质量PPT的详细大纲

### PPT幻灯片要求：
- 每个要点应包含2-3句话的实质内容，不要只写短语
- 在不同主题之间添加 section_title 分隔页
- 包含3-5个 quote 引用页（从视频中提取精彩发言）
- 至少使用1个 two_column 类型做对比分析
- 至少使用1个 highlight 类型展示关键数字或核心结论
- 如有时间发展线索，使用1个 timeline 类型
- 最后用1个 summary 总结全文

### 可用的slide_type类型：
- `section_title`: 章节分隔页 (title=章节名, bullet_points[0]=章节简述)
- `content`: 普通内容页 (title + bullet_points, 每点2-3句话)
- `quote`: 引用页 (quote=原文引语的中文翻译, speaker=说话人)
- `two_column`: 双栏对比页 (left_title, left_points, right_title, right_points)
- `highlight`: 高亮强调页 (highlight_text=大字强调内容, bullet_points=补充说明)
- `timeline`: 时间线页 (title=主题, bullet_points=各节点，格式"时间: 事件描述")
- `summary`: 总结页 (bullet_points=总结要点)

请严格按照以下JSON格式返回（不要包含其他文字）：

```json
{
  "title_cn": "视频标题的中文翻译",
  "transcript_cn": "核心内容的中文翻译摘要（2000-3000字）",
  "key_points": [
    "核心观点1（2-3句话详细描述）",
    "核心观点2"
  ],
  "mentioned_people": [
    {
      "name": "English Name",
      "name_cn": "中文名",
      "context": "在视频中被提到的上下文（2-3句话）"
    }
  ],
  "slides": [
    {
      "slide_type": "section_title",
      "title": "章节标题",
      "bullet_points": ["章节内容简述"]
    },
    {
      "slide_type": "content",
      "title": "内容标题",
      "bullet_points": ["要点1（2-3句详细描述）", "要点2", "要点3"]
    },
    {
      "slide_type": "quote",
      "quote": "精彩引语的中文翻译",
      "speaker": "说话者"
    },
    {
      "slide_type": "two_column",
      "title": "对比标题",
      "left_title": "左栏标题",
      "left_points": ["左栏要点1", "左栏要点2"],
      "right_title": "右栏标题",
      "right_points": ["右栏要点1", "右栏要点2"]
    },
    {
      "slide_type": "highlight",
      "title": "强调标题",
      "highlight_text": "关键数据或核心观点（一句话）",
      "bullet_points": ["补充说明"]
    },
    {
      "slide_type": "timeline",
      "title": "发展历程",
      "bullet_points": ["2020年: 事件1", "2021年: 事件2", "2023年: 事件3"]
    },
    {
      "slide_type": "summary",
      "title": "总结与展望",
      "bullet_points": ["总结要点1", "总结要点2"]
    }
  ]
}
```

视频标题: """


def _build_prompt(title: str, transcript: str) -> str:
    return ANALYSIS_PROMPT_TEMPLATE + title + "\n转录文本:\n" + transcript


def _chunk_transcript(transcript: str, max_chars: int = 80000) -> list[str]:
    """Split long transcripts into chunks."""
    if len(transcript) <= max_chars:
        return [transcript]

    chunks = []
    words = transcript.split()
    current_chunk = []
    current_len = 0

    for word in words:
        if current_len + len(word) + 1 > max_chars:
            chunks.append(" ".join(current_chunk))
            current_chunk = [word]
            current_len = len(word)
        else:
            current_chunk.append(word)
            current_len += len(word) + 1

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


async def analyze_content(
    title: str, transcript: str, progress_callback=None
) -> dict:
    """Analyze video transcript using LLM via OpenRouter."""
    client = get_client()

    if progress_callback:
        await progress_callback(f"正在使用 {settings.llm_model} 分析内容...")

    chunks = _chunk_transcript(transcript)

    if len(chunks) == 1:
        prompt = _build_prompt(title, transcript)
    else:
        combined = transcript[:100000]
        prompt = _build_prompt(title, combined)

    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            max_tokens=settings.llm_max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.choices[0].message.content
        logger.info(f"LLM response length: {len(response_text)} chars")
        logger.debug(f"LLM response start: {response_text[:200]}")

        # Extract JSON from response (handle markdown code blocks)
        json_text = response_text
        if "```json" in json_text:
            json_text = json_text.split("```json")[1].split("```")[0]
        elif "```" in json_text:
            json_text = json_text.split("```")[1].split("```")[0]

        result = json.loads(json_text.strip())

        if not isinstance(result, dict):
            logger.error(f"LLM returned non-dict JSON: {type(result)}")
            result = {}

        # Build mentioned_people safely
        mentioned_people = []
        for p in result.get("mentioned_people", []):
            try:
                mentioned_people.append(PersonInfo(**p))
            except Exception as e:
                logger.warning(f"Skipping invalid person entry: {e}")

        # Build slides safely
        slides = []
        for s in result.get("slides", []):
            try:
                slides.append(SlideContent(**s))
            except Exception as e:
                logger.warning(f"Skipping invalid slide entry: {e}")

        return {
            "title_cn": result.get("title_cn", ""),
            "transcript_cn": result.get("transcript_cn", ""),
            "key_points": result.get("key_points", []),
            "mentioned_people": mentioned_people,
            "slides": slides,
        }

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        logger.error(f"Response was: {response_text[:500]}")
        return {
            "title_cn": "",
            "transcript_cn": "",
            "key_points": [],
            "mentioned_people": [],
            "slides": [],
        }
    except Exception as e:
        logger.error(f"LLM API call failed: {type(e).__name__}: {e}")
        raise
