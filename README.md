# 行家说 / ExpertTalk — 设计方案

> **中文**: 行家说 — 行家懂行家
> **English**: ExpertTalk — Like minds

## 界面截图

### 首页 — 项目列表
![首页 — 项目列表](screenshots/1.png)

新建项目入口 + 历史项目列表，支持中英文切换。

### 工作区 — 人物详情
![工作区 — 人物详情](screenshots/2.jpg)

左侧按人物分组，展示关联视频标题；右侧显示人物详情、核心观点、PPT/PDF 下载。

### 工作区 — 知识脑图
![工作区 — 知识脑图](screenshots/3.jpg)

交互式脑图视图，自适应屏幕高度，可展开/折叠节点。

---

## Context

YouTube 视频智能分析系统。输入YouTube视频URL → 转录+翻译成中文 → 提取核心观点 → 生成高质量PPT → 自动发现视频中提到的人物 → 搜索这些人的采访视频 → 递归处理。支持中英文切换。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | TypeScript + React Router v7 + TailwindCSS v4 |
| 后端 | Python 3.12 + uv + FastAPI |
| 视频下载 | yt-dlp |
| 语音转录 | 本地 Whisper large-v3（CUDA GPU 加速） |
| AI分析 | OpenRouter API (OpenAI SDK)，默认模型 `google/gemini-3.1-pro-preview` |
| PPT生成 | python-pptx（16:9 宽屏，现代配色，图片嵌入） |
| 视频搜索 | yt-dlp ytsearch（无需 API Key） |
| 缓存 | SQLite per-step cache（避免重复处理） |
| 项目持久化 | SQLite projects.db（项目/任务元数据 + 结果） |
| 脑图 | markmap-lib + markmap-view（交互式 SVG） |
| PDF转换 | comtypes (PowerPoint COM) / LibreOffice headless |
| i18n | React Context（中/英文切换） |
| 前后端通信 | REST API + WebSocket（实时进度） |

---

## 项目结构

```
prj6/
├── README.md                         # 本文件
├── backend/                          # Python 后端
│   ├── pyproject.toml                # uv 项目配置
│   ├── .env                          # 环境变量（API Key 等）
│   ├── app/
│   │   ├── main.py                   # FastAPI 入口 + 缓存初始化
│   │   ├── config.py                 # 配置管理（Pydantic Settings）
│   │   ├── api/
│   │   │   ├── routes.py             # REST API 路由
│   │   │   └── websocket.py          # WebSocket 进度推送
│   │   ├── agents/
│   │   │   ├── orchestrator.py       # 编排代理（总控 + 缓存集成）
│   │   │   ├── video_fetcher.py      # 视频下载+转录
│   │   │   ├── content_analyzer.py   # LLM 翻译+分析+人物识别
│   │   │   ├── ppt_generator.py      # PPT生成（多布局+图片）
│   │   │   └── person_searcher.py    # 人物视频搜索
│   │   ├── models/
│   │   │   └── schemas.py            # Pydantic 数据模型
│   │   └── utils/
│   │       ├── cache.py              # SQLite 缓存管理器
│   │       ├── project_store.py      # SQLite 项目持久化
│   │       ├── pdf_converter.py      # PPT → PDF 转换
│   │       ├── whisper_client.py     # Whisper 封装
│   │       └── youtube_client.py     # yt-dlp 搜索封装
│   └── output/                       # PPT + cache.db + projects.db
│
├── frontend/                         # React Router v7 前端
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── app/
│   │   ├── root.tsx                  # 根布局 + LocaleProvider
│   │   ├── routes/
│   │   │   ├── home.tsx              # 首页 - 项目列表 + 新建
│   │   │   └── workspace.tsx         # 工作区 - 分屏布局
│   │   ├── components/
│   │   │   ├── app-header.tsx        # 品牌导航头 + 语言切换
│   │   │   ├── video-input.tsx       # URL输入组件
│   │   │   ├── video-sidebar.tsx     # 左侧视频列表面板
│   │   │   ├── video-detail.tsx      # 右侧视频详情面板
│   │   │   ├── video-card.tsx        # 视频结果卡片
│   │   │   ├── mindmap-view.tsx      # 交互式脑图
│   │   │   └── processing-pipeline.tsx # 处理流程可视化
│   │   ├── hooks/
│   │   │   └── use-websocket.ts      # WebSocket 进度监听
│   │   ├── lib/
│   │   │   ├── api.ts                # API 客户端
│   │   │   └── i18n.tsx              # 中英文国际化
│   │   └── types/
│   │       └── index.ts              # TypeScript 类型定义
│   └── public/
```

---

## 核心数据流

```
用户输入URL
    │
    ▼
[FastAPI] 接收请求，创建任务，返回 task_id
    │
    ▼ WebSocket 推送进度
┌─────────────────────────────────────┐
│ Orchestrator (编排代理 + 缓存检查)    │
│                                     │
│  1. VideoFetcher                    │
│     ├─ [缓存检查] fetch:{video_id}  │
│     ├─ yt-dlp 下载音频              │
│     ├─ 提取YouTube自带字幕          │
│     └─ Whisper 本地转录             │
│              │                      │
│  2. ContentAnalyzer                 │
│     ├─ [缓存检查] analyze:{id}:{model} │
│     ├─ LLM: 翻译成中文             │
│     ├─ LLM: 提取核心观点           │
│     ├─ LLM: 生成PPT大纲（多类型）  │
│     └─ LLM: 识别提到的人物         │
│              │                      │
│  ┌───────────┴──────────┐          │
│  │                      │          │
│  ▼                      ▼          │
│  3. PPTGenerator    4. PersonSearcher │
│  ├─ [缓存检查]     ├─ [缓存检查]    │
│  ├─ 多类型布局      └─ yt-dlp搜索   │
│  ├─ 图片嵌入            │          │
│  └─ 生成.pptx      找到视频URL      │
│                          │          │
│                     递归回步骤1      │
│                     (depth+1)       │
└─────────────────────────────────────┘
    │
    ▼ WebSocket 推送结果
[React Router v7 前端] 展示进度、观点、下载PPT
```

---

## 核心模块设计

### 1. 数据模型 (schemas.py)

```python
class PersonInfo(BaseModel):
    name: str
    name_cn: str                    # 中文名
    context: str                    # 在视频中被提及的上下文
    related_videos: list[str] = []  # 搜索到的相关视频URL
    thumbnail_url: str = ""         # 搜索结果的缩略图URL

class SlideContent(BaseModel):
    slide_type: str                 # title, section_title, content, quote, summary,
                                    # two_column, highlight, timeline
    title: str
    bullet_points: list[str] = []
    quote: str = ""
    speaker: str = ""
    notes: str = ""
    image_url: str = ""             # 图片URL
    highlight_text: str = ""        # highlight 类型的大字内容
    left_title: str = ""            # two_column 左栏标题
    right_title: str = ""           # two_column 右栏标题
    left_points: list[str] = []     # two_column 左栏要点
    right_points: list[str] = []    # two_column 右栏要点

class VideoAnalysis(BaseModel):
    video_id: str
    video_url: str
    title: str
    title_cn: str = ""              # 中文标题
    transcript: str = ""            # 英文转录（截取前500字）
    transcript_cn: str = ""         # 中文翻译
    key_points: list[str] = []      # 核心观点
    mentioned_people: list[PersonInfo] = []
    slides: list[SlideContent] = []
    ppt_filename: str = ""          # 生成的PPT文件名
    depth: int = 0                  # 当前递归深度

class PipelineStep(BaseModel):
    key: str                        # 步骤标识（如 fetch, analyze, ppt）
    label: str                      # 显示名称
    status: str = "pending"         # pending/in_progress/completed/failed
    detail: str = ""                # 附加信息（如 "已缓存，跳过"）

class TaskProgress(BaseModel):
    task_id: str
    status: str = "pending"         # pending/processing/completed/failed
    current_step: str = ""          # 当前步骤描述
    progress_pct: float = 0         # 0-100
    total_videos: int = 0
    processed_videos: int = 0
    results: list[VideoAnalysis] = []
    error: str = ""
    steps: list[PipelineStep] = []  # 流水线步骤列表

class TaskCreate(BaseModel):
    video_url: str
    max_depth: int = 2              # 递归深度
    max_videos_per_person: int = 2  # 每人最多搜几个视频
```

### 2. Orchestrator (orchestrator.py)

- 接收任务，管理整体流程
- 维护 `processed_urls: set` 避免重复
- 控制递归深度 `max_depth`
- **每步执行前查 SQLite 缓存**，命中则跳过并显示"已缓存，跳过"
- 通过 WebSocket callback 推送进度（含步骤列表状态）
- 使用 `asyncio` 异步处理
- 传递 `thumbnail_url` 给 PPT 生成器

### 3. VideoFetcher (video_fetcher.py)

- 优先提取 YouTube 自带字幕（节省转录时间）
- 无字幕时下载音频，调用本地 Whisper
- Whisper 模型：`large-v3`（最高精度，CUDA GPU 加速）
- 返回 `video_id`, `title`, `thumbnail`, `transcript`, `duration`

### 4. ContentAnalyzer (content_analyzer.py)

- 单次 OpenRouter LLM API 调用完成：翻译 + 观点提取 + 人物识别 + PPT大纲
- 使用 JSON 格式要求确保返回格式稳定
- 长视频分段处理，避免超 token 限制（`llm_max_tokens: 32000`）
- 生成 **15-25 页高质量** slides，每个 bullet point 2-3 句话
- 支持 7 种 slide 类型：
  - `section_title` — 章节分隔页
  - `content` — 普通内容页
  - `quote` — 引用页（3-5个）
  - `two_column` — 左右双栏对比
  - `highlight` — 大字强调关键数据/金句
  - `timeline` — 时间线
  - `summary` — 总结页

### 5. PPTGenerator (ppt_generator.py)

- **16:9 宽屏**（13.333×7.5 英寸）
- **现代配色方案**：深海军蓝主色 + 蓝色强调 + 暖金色点缀
- 中文字体支持（Microsoft YaHei，East Asian fallback via XML）
- **8 种幻灯片布局**：
  - `title` — 封面页（可嵌入视频缩略图）
  - `section_title` — 章节分隔页（深色背景 + 金色横线）
  - `content` — 内容页（蓝色圆点 bullet + 顶部标题栏）
  - `quote` — 引用页（左侧蓝色竖条 + 大字引语 + 金色破折号）
  - `two_column` — 双栏对比页（中间竖分割线 + 左右独立标题）
  - `highlight` — 高亮强调页（蓝色背景 + 44pt 居中大字）
  - `timeline` — 时间线页（左侧蓝色竖线 + 蓝金交替圆形节点）
  - `summary` — 总结页
- 人物介绍页（字母头像或真实搜索缩略图）
- 目录页 + 结束页
- 每页底部装饰条 + 页码

### 6. PersonSearcher (person_searcher.py)

- 使用 **yt-dlp ytsearch** 搜索 `"{人名} interview"` 和 `"{人名} talk keynote"`
- 无需 API Key
- 过滤：时长 > 5分钟，排除 shorts
- 每人返回 top N 个最相关视频（含 thumbnail）

### 7. 缓存系统 (cache.py)

SQLite 单文件缓存，位于 `output/cache.db`：

| 步骤 | Cache Key | TTL | 说明 |
|------|-----------|-----|------|
| fetch | `fetch:{video_id}` | 永久 | 同视频转录不变 |
| analyze | `analyze:{video_id}:{llm_model}` | 永久 | 换模型自动失效 |
| ppt | `ppt:{video_id}:{llm_model}` | 永久 | 同时检查文件是否存在 |
| search | `search:{person_name}:{max_per_person}` | 7天 | 搜索结果会变 |

缓存命中时：步骤 detail 显示"已缓存，跳过"，秒级完成。

---

## API 设计

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/tasks` | 创建分析任务（同时创建项目） |
| GET | `/api/tasks/{id}` | 获取任务状态和结果 |
| GET | `/api/tasks/{id}/download/{video_id}` | 下载某个视频的PPT |
| GET | `/api/tasks/{id}/download/{video_id}/pdf` | 下载 PDF |
| GET | `/api/projects` | 项目列表（精简，不含 results） |
| GET | `/api/projects/{id}` | 项目详情（含完整 TaskProgress） |
| DELETE | `/api/projects/{id}` | 删除项目 |
| GET | `/api/test-connectivity` | 测试 YouTube/Google 连通性 |
| WS | `/ws/tasks/{id}` | WebSocket 实时进度 |

---

## 前端界面设计（中英双语）

### 路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | home.tsx | 项目列表 + 新建项目入口 |
| `/workspace/:taskId` | workspace.tsx | 分屏工作区 |

### 首页布局

1. **顶部**: 品牌 Header（行家说 / ExpertTalk + 语言切换）
2. **新建区**: URL输入框 + 参数设置 + 开始分析 → 跳转 workspace
3. **项目列表**: 卡片网格，显示标题/状态/时间/视频数

### 工作区布局（左右分屏）

1. **顶部**: Header + 项目标题 + 返回按钮
2. **左侧** (320px): 进度条 + 筛选器 + 视频列表（按深度分组）
3. **右侧** (flex-1): 选中视频的详情（观点/人物/翻译/PPT下载/脑图）

### 旧页面布局（已替换）

1. **顶部**: 输入区 - URL输入框 + 参数设置（递归深度、每人视频数）+ 开始分析按钮
2. **中间**: Pipeline 步骤列表 - 每步显示状态图标（等待/进行中/完成/失败）+ 详情
3. **下方**: 结果区 - 卡片式展示每个已处理的视频
   - 视频标题（中英文）
   - 核心观点列表（折叠/展开）
   - 识别到的人物标签 + 相关视频数
   - PPT 下载按钮 + slide 页数显示
   - 展开可看完整中文翻译

### 组件

- `video-input.tsx`: URL 输入 + 参数调节 + 提交
- `processing-pipeline.tsx`: 步骤列表可视化（基于 PipelineStep 状态）
- `video-card.tsx`: 视频结果卡片（含折叠详情）

---

## 错误处理

- yt-dlp 下载失败 → 重试2次，仍失败则跳过并记录
- Whisper 转录失败 → fallback 到 YouTube 自动字幕
- LLM API 超时/限流 → 记录错误，标记步骤失败
- 人物搜索失败 → 记录错误，跳过人物搜索
- PPT 生成失败 → 记录错误，不影响其他视频处理

---

## 需要用户提供的 API Key

- `OPENROUTER_API_KEY`: OpenRouter API（用于 LLM 内容分析）

> 注：视频搜索使用 yt-dlp ytsearch，无需 YouTube API Key。

---

## 验证方式

1. 输入一个已知的 YouTube 视频 URL
2. 确认能成功下载和转录
3. 确认中文翻译和核心观点提取质量
4. 确认 PPT 生成正确且包含多种布局（双栏/高亮/时间线等）
5. 确认人物识别和递归搜索正常工作
6. 确认 Web 界面进度实时更新（步骤列表状态变化）
7. 再次提交同一视频 → 所有步骤显示"已缓存，跳过"，秒级完成
8. 修改 config 中 `llm_model` → 分析和 PPT 缓存自动失效，重新执行
