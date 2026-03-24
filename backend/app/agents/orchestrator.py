import asyncio
import logging
import uuid
from pathlib import Path
from typing import Callable

from app.config import settings
from app.models.schemas import (
    TaskProgress,
    VideoAnalysis,
    PersonInfo,
    SlideContent,
    PipelineStep,
)
from app.agents.video_fetcher import fetch_video, extract_video_id, get_fetch_progress, clear_fetch_progress
from app.agents.content_analyzer import analyze_content
from app.agents.ppt_generator import generate_ppt
from app.agents.person_searcher import search_related_videos
from app.utils.cache import get_cache
from app.utils.project_store import get_project_store

logger = logging.getLogger(__name__)

# In-memory task store
_tasks: dict[str, TaskProgress] = {}

# Search cache TTL: 7 days
_SEARCH_TTL = 7 * 24 * 3600


def get_task(task_id: str) -> TaskProgress | None:
    return _tasks.get(task_id)


def create_task(video_url: str, max_depth: int = 2, max_videos_per_person: int = 2) -> str:
    task_id = str(uuid.uuid4())[:8]
    _tasks[task_id] = TaskProgress(
        task_id=task_id,
        status="pending",
        current_step="任务已创建，等待开始...",
    )
    # Persist to SQLite
    store = get_project_store()
    store.create_project(task_id, video_url, max_depth, max_videos_per_person)
    return task_id


def load_projects_to_memory():
    """Load completed/failed projects from SQLite into _tasks dict on startup."""
    store = get_project_store()
    import json
    for proj in store.list_projects():
        tid = proj["id"]
        if tid in _tasks:
            continue
        try:
            pj = json.loads(proj.get("progress_json", "{}"))
            if pj and pj.get("task_id"):
                _tasks[tid] = TaskProgress(**pj)
            else:
                _tasks[tid] = TaskProgress(
                    task_id=tid,
                    status=proj.get("status", "completed"),
                    current_step="已完成" if proj.get("status") == "completed" else "",
                )
        except Exception as e:
            logger.warning(f"Failed to load project {tid}: {e}")
            _tasks[tid] = TaskProgress(
                task_id=tid,
                status=proj.get("status", "failed"),
                current_step=f"加载失败: {e}",
            )


def _update_step(task: TaskProgress, key: str, status: str, detail: str = ""):
    for step in task.steps:
        if step.key == key:
            step.status = status
            if detail:
                step.detail = detail
            break


async def process_task(
    task_id: str,
    video_url: str,
    max_depth: int = 2,
    max_videos_per_person: int = 2,
    ws_callback: Callable | None = None,
):
    """Main orchestration: process a video and recursively discover related content."""
    task = _tasks[task_id]
    task.status = "processing"
    cache = get_cache()
    store = get_project_store()

    def _persist():
        """Persist current task state to SQLite."""
        try:
            import json
            store.update_project(
                task_id,
                status=task.status,
                title=task.results[0].title if task.results else "",
                title_cn=task.results[0].title_cn if task.results else "",
                progress_json=json.dumps(task.model_dump(), ensure_ascii=False, default=str),
            )
        except Exception as e:
            logger.warning(f"Failed to persist project {task_id}: {e}")

    # Initialize pipeline steps for main video
    task.steps = [
        PipelineStep(key="fetch", label="获取视频信息"),
        PipelineStep(key="analyze", label="AI 内容分析"),
        PipelineStep(key="ppt", label="生成 PPT"),
        PipelineStep(key="search_people", label="搜索相关人物视频"),
    ]

    processed_urls: set[str] = set()
    all_results: list[VideoAnalysis] = []

    # Queue: (url, depth)
    queue: list[tuple[str, int]] = [(video_url, 0)]
    total_estimated = 1

    async def progress(msg: str):
        task.current_step = msg
        task.progress_pct = min(
            (len(all_results) / max(total_estimated, 1)) * 100, 99
        )
        task.processed_videos = len(all_results)
        task.total_videos = total_estimated
        if ws_callback:
            await ws_callback(task.model_dump())

    try:
        while queue:
            url, depth = queue.pop(0)

            if url in processed_urls:
                continue
            processed_urls.add(url)

            # Determine step key for depth>0 videos
            current_step_key = None
            if depth > 0:
                try:
                    vid_id = extract_video_id(url)
                    for step in task.steps:
                        if step.key.endswith(vid_id):
                            current_step_key = step.key
                            break
                except Exception:
                    pass

            await progress(f"正在处理视频：{url}")

            # ── Step 1: Fetch and transcribe ─────────────────────────────
            step_key = "fetch" if depth == 0 else current_step_key
            if step_key:
                _update_step(task, step_key, "in_progress")
            await progress("正在获取视频信息...")

            video_id = extract_video_id(url)
            fetch_cache_key = f"fetch:{video_id}"
            cached_fetch = cache.get(fetch_cache_key)

            if cached_fetch:
                video_data = cached_fetch
                logger.info(f"Cache hit for fetch: {video_id}")
                if step_key:
                    _update_step(task, step_key, "completed", detail="已缓存，跳过")
                await progress(f"获取视频信息（已缓存）：{video_data['title']}")
            else:
                try:
                    # Poll _fetch_progress in background while fetch_video runs
                    async def _poll_fetch():
                        while True:
                            await asyncio.sleep(1.5)
                            fp = get_fetch_progress(video_id)
                            if fp:
                                detail = fp.get("detail", "")
                                if step_key:
                                    _update_step(task, step_key, "in_progress", detail=detail)
                                await progress(detail)

                    poll_task = asyncio.create_task(_poll_fetch())
                    try:
                        video_data = await fetch_video(url, progress_callback=progress)
                        cache.set(fetch_cache_key, video_data)
                    finally:
                        poll_task.cancel()
                        clear_fetch_progress(video_id)
                except Exception as e:
                    logger.error(f"Failed to fetch video {url}: {e}")
                    if step_key:
                        _update_step(task, step_key, "failed", detail=str(e))
                    await progress(f"获取视频失败 {url}：{e}")
                    continue

                if step_key:
                    _update_step(task, step_key, "completed", detail=f"视频: {video_data['title']}")

            # ── Step 2: Analyze with LLM ─────────────────────────────────
            if depth == 0:
                _update_step(task, "analyze", "in_progress", detail=f"使用 {settings.llm_model} 分析中...")
            await progress(f"正在使用 {settings.llm_model} 分析：{video_data['title']}")

            analyze_cache_key = f"analyze:{video_id}:{settings.llm_model}"
            cached_analysis = cache.get(analyze_cache_key)

            if cached_analysis:
                analysis = cached_analysis
                # Reconstruct Pydantic objects from cached dicts
                analysis["mentioned_people"] = [
                    PersonInfo(**p) if isinstance(p, dict) else p
                    for p in analysis.get("mentioned_people", [])
                ]
                analysis["slides"] = [
                    SlideContent(**s) if isinstance(s, dict) else s
                    for s in analysis.get("slides", [])
                ]
                logger.info(f"Cache hit for analyze: {video_id}")
                if depth == 0:
                    _update_step(task, "analyze", "completed", detail="已缓存，跳过")
                await progress(f"内容分析（已缓存）：{video_data['title']}")
            else:
                try:
                    analysis = await analyze_content(
                        title=video_data["title"],
                        transcript=video_data["transcript"],
                        progress_callback=progress,
                    )
                    # Cache serializable version (Pydantic → dict)
                    cache_value = {
                        "title_cn": analysis.get("title_cn", ""),
                        "transcript_cn": analysis.get("transcript_cn", ""),
                        "key_points": analysis.get("key_points", []),
                        "mentioned_people": [
                            p.model_dump() if hasattr(p, "model_dump") else p
                            for p in analysis.get("mentioned_people", [])
                        ],
                        "slides": [
                            s.model_dump() if hasattr(s, "model_dump") else s
                            for s in analysis.get("slides", [])
                        ],
                    }
                    cache.set(analyze_cache_key, cache_value)
                except Exception as e:
                    logger.error(f"Failed to analyze {url}: {type(e).__name__}: {e}", exc_info=True)
                    if depth == 0:
                        _update_step(task, "analyze", "failed", detail=str(e))
                    elif current_step_key:
                        _update_step(task, current_step_key, "failed", detail=str(e))
                    await progress(f"分析失败 {url}：{e}")
                    continue

                if depth == 0:
                    slides_count = len(analysis.get("slides", []))
                    people_count = len(analysis.get("mentioned_people", []))
                    _update_step(task, "analyze", "completed",
                                 detail=f"{slides_count} 页幻灯片，{people_count} 位人物")

            # ── Step 3: Generate PPT ─────────────────────────────────────
            if depth == 0:
                _update_step(task, "ppt", "in_progress", detail="正在生成 PPT 幻灯片...")
            await progress("正在生成 PPT 幻灯片...")

            thumbnail_url = video_data.get("thumbnail", "")
            ppt_cache_key = f"ppt:{video_id}:{settings.llm_model}"
            cached_ppt = cache.get(ppt_cache_key)

            # Check that cached PPT file actually exists on disk
            if cached_ppt:
                ppt_path = settings.output_dir / cached_ppt
                if not ppt_path.exists():
                    logger.info(f"Cached PPT file missing on disk: {cached_ppt}")
                    cached_ppt = None

            if cached_ppt:
                ppt_filename = cached_ppt
                logger.info(f"Cache hit for PPT: {video_id}")
                if depth == 0:
                    _update_step(task, "ppt", "completed", detail="已缓存，跳过")
                await progress(f"PPT 生成（已缓存）：{ppt_filename}")
            else:
                try:
                    ppt_filename = await generate_ppt(
                        video_id=video_data["video_id"],
                        title=video_data["title"],
                        title_cn=analysis.get("title_cn", ""),
                        slides=analysis.get("slides", []),
                        mentioned_people=analysis.get("mentioned_people", []),
                        thumbnail_url=thumbnail_url,
                        progress_callback=progress,
                    )
                    cache.set(ppt_cache_key, ppt_filename)
                except Exception as e:
                    logger.error(f"Failed to generate PPT for {url}: {e}")
                    if depth == 0:
                        _update_step(task, "ppt", "failed", detail=str(e))
                    ppt_filename = ""

                if depth == 0 and ppt_filename:
                    _update_step(task, "ppt", "completed", detail=f"已生成: {ppt_filename}")

            # Build result
            mentioned_people = analysis.get("mentioned_people", [])
            result = VideoAnalysis(
                video_id=video_data["video_id"],
                video_url=url,
                title=video_data["title"],
                title_cn=analysis.get("title_cn", ""),
                transcript=video_data["transcript"][:500],
                transcript_cn=analysis.get("transcript_cn", ""),
                key_points=analysis.get("key_points", []),
                mentioned_people=mentioned_people,
                slides=analysis.get("slides", []),
                ppt_filename=ppt_filename,
                depth=depth,
            )
            all_results.append(result)
            task.results = all_results

            # Mark depth>0 step as completed
            if current_step_key:
                _update_step(task, current_step_key, "completed")

            # Persist after each video completes
            _persist()

            await progress(
                f"已完成：{video_data['title']}（已处理 {len(all_results)} 个视频）"
            )

            # ── Step 4: Search for related people's videos ───────────────
            if depth < max_depth - 1 and mentioned_people:
                people_names = "、".join(p.name_cn or p.name for p in mentioned_people[:3])
                _update_step(task, "search_people", "in_progress",
                             detail=f"搜索: {people_names}")
                await progress(f"正在搜索相关人物视频：{people_names}")

                # Check per-person cache; collect uncached people
                all_search_cached = True
                related: dict[str, list[dict]] = {}
                uncached_people: list[PersonInfo] = []

                for person in mentioned_people:
                    search_key = f"search:{person.name}:{max_videos_per_person}"
                    cached_search = cache.get(search_key, ttl_seconds=_SEARCH_TTL)
                    if cached_search is not None:
                        related[person.name] = cached_search
                        logger.info(f"Cache hit for search: {person.name}")
                    else:
                        all_search_cached = False
                        uncached_people.append(person)

                if all_search_cached:
                    await progress("搜索相关人物视频（已缓存）")
                    _update_step(task, "search_people", "completed", detail="已缓存，跳过")
                else:
                    try:
                        fresh_results = await search_related_videos(
                            uncached_people,
                            max_per_person=max_videos_per_person,
                            progress_callback=progress,
                        )
                        # Cache each person's results
                        for person_name, videos in fresh_results.items():
                            search_key = f"search:{person_name}:{max_videos_per_person}"
                            cache.set(search_key, videos)
                            related[person_name] = videos

                        total_found = sum(len(v) for v in related.values())
                        _update_step(task, "search_people", "completed",
                                     detail=f"找到 {total_found} 个相关视频")
                    except Exception as e:
                        logger.error(f"Person search failed: {e}")
                        _update_step(task, "search_people", "failed", detail=str(e))
                        related = {}

                # Process search results: enqueue videos + set thumbnails
                for person_name, videos in related.items():
                    for v in videos:
                        v_url = v["url"]
                        if v_url not in processed_urls:
                            sk = f"person_{v['video_id']}"
                            task.steps.append(PipelineStep(
                                key=sk,
                                label=f"分析人物视频：{person_name}",
                            ))
                            queue.append((v_url, depth + 1))
                            total_estimated += 1

                    # Update person's related_videos + thumbnail_url
                    for person in mentioned_people:
                        if person.name == person_name:
                            person.related_videos = [v["url"] for v in videos]
                            if videos and videos[0].get("thumbnail"):
                                person.thumbnail_url = videos[0]["thumbnail"]

            else:
                # No search needed, mark as completed (skipped)
                _update_step(task, "search_people", "completed",
                             detail="无需搜索" if not mentioned_people else "已达最大深度")

        # Done
        task.status = "completed"
        task.progress_pct = 100
        task.current_step = f"全部完成！共处理 {len(all_results)} 个视频。"
        task.results = all_results
        _persist()
        if ws_callback:
            await ws_callback(task.model_dump())

    except Exception as e:
        logger.exception(f"Task {task_id} failed: {e}")
        task.status = "failed"
        task.error = str(e)
        task.current_step = f"错误：{e}"
        _persist()
        if ws_callback:
            await ws_callback(task.model_dump())
