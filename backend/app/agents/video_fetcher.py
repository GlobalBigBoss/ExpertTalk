import asyncio
import json
import logging
import re
import tempfile
from pathlib import Path

import yt_dlp

from app.config import settings
from app.utils.whisper_client import transcribe_audio

logger = logging.getLogger(__name__)

# ── Module-level progress storage (thread-safe for simple dict writes) ────
_fetch_progress: dict[str, dict] = {}


def get_fetch_progress(video_id: str) -> dict | None:
    """Get current fetch progress for a video (called from async orchestrator)."""
    return _fetch_progress.get(video_id)


def clear_fetch_progress(video_id: str) -> None:
    """Clean up progress entry after fetch completes."""
    _fetch_progress.pop(video_id, None)


def _ydl_progress_hook(video_id: str):
    """Return a yt-dlp progress_hooks callback that writes to _fetch_progress."""
    def hook(d):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            speed = d.get("speed") or 0
            pct = (downloaded / total * 100) if total else 0
            if speed:
                speed_str = f"{speed / 1024 / 1024:.1f}MB/s"
                detail = f"下载音频 {pct:.0f}% ({speed_str})"
            else:
                detail = f"下载音频 {pct:.0f}%"
            _fetch_progress[video_id] = {
                "phase": "download",
                "pct": round(pct, 1),
                "detail": detail,
            }
        elif d["status"] == "finished":
            _fetch_progress[video_id] = {
                "phase": "converting",
                "pct": 100,
                "detail": "下载完成，正在转换为 MP3...",
            }
    return hook


def _ydl_proxy_opts() -> dict:
    """Return yt-dlp proxy options if configured."""
    if settings.http_proxy:
        return {"proxy": settings.http_proxy}
    return {}


def extract_video_id(url: str) -> str:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r"(?:v=|\/videos\/|embed\/|youtu\.be\/|\/v\/|\/e\/)([^#\&\?\n]*)",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Cannot extract video ID from: {url}")


def _fetch_video_sync(url: str) -> dict:
    """Synchronous core logic for fetching video data (runs in thread pool)."""
    video_id = extract_video_id(url)

    # Phase: extracting info
    _fetch_progress[video_id] = {"phase": "info", "detail": "正在获取视频信息..."}

    ydl_opts_info = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["en"],
        **_ydl_proxy_opts(),
    }

    with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
        info = ydl.extract_info(url, download=False)

    title = info.get("title", "Unknown")
    duration = info.get("duration", 0)
    thumbnail = info.get("thumbnail", "")

    _fetch_progress[video_id] = {"phase": "info_done", "detail": f"视频: {title}"}

    # Try to get subtitles first
    transcript_text = None
    subtitle_segments = []

    subtitles = info.get("subtitles", {})
    auto_captions = info.get("automatic_captions", {})

    _fetch_progress[video_id] = {"phase": "subtitles", "detail": "正在检查字幕..."}

    for sub_source in [subtitles, auto_captions]:
        for lang in ["en", "en-US", "en-GB"]:
            if lang in sub_source:
                _fetch_progress[video_id] = {"phase": "subtitles", "detail": f"正在提取 {lang} 字幕..."}
                ydl_opts_sub = {
                    "quiet": True,
                    "skip_download": True,
                    "writesubtitles": True,
                    "writeautomaticsub": True,
                    "subtitleslangs": [lang],
                    "subtitlesformat": "json3",
                    "outtmpl": tempfile.mktemp(suffix=""),
                    **_ydl_proxy_opts(),
                }
                try:
                    with yt_dlp.YoutubeDL(ydl_opts_sub) as ydl:
                        sub_info = ydl.extract_info(url, download=True)
                        requested_subs = sub_info.get("requested_subtitles", {})
                        if requested_subs:
                            for sub_lang, sub_data in requested_subs.items():
                                sub_file = sub_data.get("filepath")
                                if sub_file and Path(sub_file).exists():
                                    with open(sub_file, "r", encoding="utf-8") as f:
                                        sub_json = json.load(f)
                                    events = sub_json.get("events", [])
                                    texts = []
                                    for event in events:
                                        segs = event.get("segs", [])
                                        text = "".join(
                                            s.get("utf8", "") for s in segs
                                        ).strip()
                                        if text and text != "\n":
                                            texts.append(text)
                                    transcript_text = " ".join(texts)
                                    Path(sub_file).unlink(missing_ok=True)
                                    break
                except Exception as e:
                    logger.warning(f"Subtitle extraction failed: {e}")

                if transcript_text:
                    break
        if transcript_text:
            break

    # If no subtitles, download audio and transcribe with Whisper
    if not transcript_text:
        logger.info("No subtitles found, falling back to Whisper transcription...")
        _fetch_progress[video_id] = {"phase": "download", "pct": 0, "detail": "无字幕，开始下载音频..."}

        with tempfile.TemporaryDirectory() as tmpdir:
            audio_path = str(Path(tmpdir) / f"{video_id}.mp3")
            ydl_opts_audio = {
                "quiet": True,
                "format": "bestaudio/best",
                "outtmpl": str(Path(tmpdir) / f"{video_id}.%(ext)s"),
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    }
                ],
                "progress_hooks": [_ydl_progress_hook(video_id)],
                **_ydl_proxy_opts(),
            }
            with yt_dlp.YoutubeDL(ydl_opts_audio) as ydl:
                ydl.download([url])

            _fetch_progress[video_id] = {"phase": "transcribing", "detail": "Whisper 转录中..."}
            result = transcribe_audio(audio_path)
            transcript_text = result["text"]
            subtitle_segments = result.get("segments", [])
    else:
        _fetch_progress[video_id] = {"phase": "subtitles_done", "detail": "字幕提取完成"}

    return {
        "video_id": video_id,
        "url": url,
        "title": title,
        "duration": duration,
        "thumbnail": thumbnail,
        "transcript": transcript_text or "",
        "segments": subtitle_segments,
    }


def check_video_accessible(url: str) -> dict:
    """Quick check if a YouTube video is accessible (no download). Returns video info or raises."""
    video_id = extract_video_id(url)
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        **_ydl_proxy_opts(),
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "accessible": True,
        "video_id": video_id,
        "title": info.get("title", "Unknown"),
        "duration": info.get("duration", 0),
        "has_subtitles": bool(info.get("subtitles", {}).get("en") or info.get("automatic_captions", {}).get("en")),
    }


async def fetch_video(url: str, progress_callback=None) -> dict:
    """Download video audio, transcribe, and return structured data."""
    if progress_callback:
        await progress_callback("正在获取视频信息...")

    result = await asyncio.to_thread(_fetch_video_sync, url)

    if progress_callback:
        await progress_callback(f"视频获取完成：{result['title']}")

    return result
