import asyncio
import logging

from app.utils.youtube_client import search_person_videos
from app.models.schemas import PersonInfo

logger = logging.getLogger(__name__)


async def search_related_videos(
    people: list[PersonInfo],
    max_per_person: int = 2,
    progress_callback=None,
) -> dict[str, list[dict]]:
    """Search YouTube for interview videos of mentioned people.

    Returns a dict mapping person name to list of video results.
    """
    results = {}

    for person in people:
        if progress_callback:
            await progress_callback(
                f"正在搜索 {person.name_cn}（{person.name}）的视频..."
            )

        try:
            videos = await asyncio.to_thread(search_person_videos, person.name, max_per_person)
            if videos:
                results[person.name] = videos
                logger.info(
                    f"Found {len(videos)} videos for {person.name}"
                )
        except Exception as e:
            logger.error(f"Failed to search videos for {person.name}: {e}")

    return results
