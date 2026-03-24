import logging

import yt_dlp

from app.config import settings

logger = logging.getLogger(__name__)


def _ydl_proxy_opts() -> dict:
    if settings.http_proxy:
        return {"proxy": settings.http_proxy}
    return {}


def search_person_videos(
    person_name: str, max_results: int = 5
) -> list[dict]:
    """Search YouTube for interview videos of a person using yt-dlp ytsearch."""
    queries = [
        f"{person_name} interview",
        f"{person_name} talk keynote",
    ]

    all_results = []
    seen_ids = set()

    for query in queries:
        search_url = f"ytsearch{max_results}:{query}"
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
            **_ydl_proxy_opts(),
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(search_url, download=False)

            entries = info.get("entries", []) if info else []
            for entry in entries:
                if not entry:
                    continue
                video_id = entry.get("id", "")
                if not video_id or video_id in seen_ids:
                    continue

                duration = entry.get("duration") or 0
                if 0 < duration < settings.min_video_duration:
                    continue

                seen_ids.add(video_id)
                all_results.append({
                    "video_id": video_id,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "title": entry.get("title", ""),
                    "description": (entry.get("description") or "")[:200],
                    "thumbnail": entry.get("thumbnail", ""),
                    "duration": duration,
                })

        except Exception as e:
            logger.error(f"yt-dlp search failed for '{query}': {e}")

    return all_results[:max_results]
