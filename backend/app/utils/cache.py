"""SQLite-backed per-step cache for the video analysis pipeline."""

import json
import sqlite3
import time
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class CacheManager:
    """Simple key-value cache backed by a single SQLite table."""

    def __init__(self, db_path: Path):
        self._db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS cache "
            "(key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at REAL NOT NULL)"
        )
        self._conn.commit()

    def get(self, key: str, ttl_seconds: float | None = None) -> Any | None:
        """Return deserialized value, or None on miss / expired."""
        row = self._conn.execute(
            "SELECT value, created_at FROM cache WHERE key = ?", (key,)
        ).fetchone()
        if row is None:
            return None
        value_json, created_at = row
        if ttl_seconds is not None and (time.time() - created_at) > ttl_seconds:
            self._conn.execute("DELETE FROM cache WHERE key = ?", (key,))
            self._conn.commit()
            logger.debug(f"Cache expired: {key}")
            return None
        logger.debug(f"Cache hit: {key}")
        try:
            return json.loads(value_json)
        except json.JSONDecodeError:
            return None

    def set(self, key: str, value: Any) -> None:
        """Store a JSON-serializable value."""
        value_json = json.dumps(value, ensure_ascii=False, default=str)
        self._conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)",
            (key, value_json, time.time()),
        )
        self._conn.commit()
        logger.debug(f"Cache set: {key} ({len(value_json)} bytes)")

    def delete(self, key: str) -> None:
        """Remove a cache entry."""
        self._conn.execute("DELETE FROM cache WHERE key = ?", (key,))
        self._conn.commit()

    def clear(self) -> None:
        """Remove all cache entries."""
        self._conn.execute("DELETE FROM cache")
        self._conn.commit()
        logger.info("Cache cleared")

    def close(self):
        self._conn.close()


# Module-level singleton
_cache: CacheManager | None = None


def get_cache() -> CacheManager:
    """Get or create the global CacheManager singleton."""
    global _cache
    if _cache is None:
        from app.config import settings
        _cache = CacheManager(settings.output_dir / "cache.db")
    return _cache
