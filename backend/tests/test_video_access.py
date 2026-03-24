"""Test video accessibility via yt-dlp.

Run with: cd backend && uv run pytest tests/test_video_access.py -v
"""

import pytest
from app.agents.video_fetcher import check_video_accessible, extract_video_id


TEST_VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


class TestExtractVideoId:
    def test_standard_url(self):
        assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_short_url(self):
        assert extract_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_bare_id(self):
        assert extract_video_id("dQw4w9WgXcQ") == "dQw4w9WgXcQ"

    def test_invalid_url(self):
        with pytest.raises(ValueError):
            extract_video_id("not-a-url")


class TestVideoAccessibility:
    """These tests require network access to YouTube."""

    def test_video_accessible(self):
        """Core test: can we reach YouTube and get video info?"""
        result = check_video_accessible(TEST_VIDEO_URL)
        assert result["accessible"] is True
        assert result["video_id"] == "dQw4w9WgXcQ"
        assert result["title"]  # non-empty
        assert result["duration"] > 0
        print(f"\n  Video: {result['title']}")
        print(f"  Duration: {result['duration']}s")
        print(f"  Subtitles: {result['has_subtitles']}")

    def test_invalid_video_raises(self):
        """Non-existent video should raise an error."""
        with pytest.raises(Exception):
            check_video_accessible("https://www.youtube.com/watch?v=INVALID_ID_XXX")
