from pydantic import BaseModel


class TaskCreate(BaseModel):
    video_url: str
    max_depth: int = 2
    max_videos_per_person: int = 2


class PersonInfo(BaseModel):
    name: str
    name_cn: str
    context: str
    related_videos: list[str] = []
    thumbnail_url: str = ""


class SlideContent(BaseModel):
    slide_type: str  # title, section_title, content, quote, summary, two_column, highlight, timeline
    title: str
    bullet_points: list[str] = []
    quote: str = ""
    speaker: str = ""
    notes: str = ""
    image_url: str = ""
    highlight_text: str = ""
    left_title: str = ""
    right_title: str = ""
    left_points: list[str] = []
    right_points: list[str] = []


class VideoAnalysis(BaseModel):
    video_id: str
    video_url: str
    title: str
    title_cn: str = ""
    transcript: str = ""
    transcript_cn: str = ""
    key_points: list[str] = []
    mentioned_people: list[PersonInfo] = []
    slides: list[SlideContent] = []
    ppt_filename: str = ""
    depth: int = 0


class PipelineStep(BaseModel):
    key: str
    label: str
    status: str = "pending"  # pending / in_progress / completed / failed
    detail: str = ""


class TaskProgress(BaseModel):
    task_id: str
    status: str = "pending"  # pending / processing / completed / failed
    current_step: str = ""
    progress_pct: float = 0.0
    total_videos: int = 0
    processed_videos: int = 0
    results: list[VideoAnalysis] = []
    error: str = ""
    steps: list[PipelineStep] = []
