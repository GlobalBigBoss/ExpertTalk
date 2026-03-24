from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    youtube_api_key: str = ""

    whisper_model: str = "large-v3"
    whisper_device: str = "cuda"

    max_recursion_depth: int = 2
    max_videos_per_person: int = 2
    min_video_duration: int = 300
    max_video_duration: int = 7200

    output_dir: Path = Path(__file__).parent.parent / "output"

    # LLM settings (OpenRouter)
    llm_model: str = "google/gemini-3.1-pro-preview"
    llm_max_tokens: int = 32000

    # Proxy (set if behind GFW, e.g. "http://127.0.0.1:7890")
    http_proxy: str = ""

    model_config = {
        "env_file": str(Path(__file__).parent.parent / ".env"),
        "env_file_encoding": "utf-8",
    }


settings = Settings()
