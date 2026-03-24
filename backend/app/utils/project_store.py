"""SQLite-backed project persistence for the video analysis pipeline."""

import json
import sqlite3
import time
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class ProjectStore:
    """Persists project (task) metadata and results in SQLite."""

    def __init__(self, db_path: Path):
        self._db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                video_url TEXT NOT NULL,
                title TEXT DEFAULT '',
                title_cn TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                max_depth INTEGER DEFAULT 2,
                max_videos_per_person INTEGER DEFAULT 2,
                progress_json TEXT DEFAULT '{}',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        self._conn.commit()

    def create_project(
        self,
        task_id: str,
        video_url: str,
        max_depth: int = 2,
        max_videos_per_person: int = 2,
    ) -> dict:
        now = time.time()
        self._conn.execute(
            """INSERT INTO projects (id, video_url, max_depth, max_videos_per_person, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (task_id, video_url, max_depth, max_videos_per_person, now, now),
        )
        self._conn.commit()
        logger.info(f"Project created: {task_id}")
        return self._row_to_dict(self._conn.execute(
            "SELECT * FROM projects WHERE id = ?", (task_id,)
        ).fetchone())

    def update_project(self, task_id: str, **kwargs) -> None:
        if not kwargs:
            return
        kwargs["updated_at"] = time.time()
        set_clause = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [task_id]
        self._conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?",
            values,
        )
        self._conn.commit()

    def get_project(self, task_id: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM projects WHERE id = ?", (task_id,)
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def list_projects(self) -> list[dict]:
        rows = self._conn.execute(
            "SELECT id, video_url, title, title_cn, status, max_depth, max_videos_per_person, created_at, updated_at, progress_json FROM projects ORDER BY updated_at DESC"
        ).fetchall()
        result = []
        for row in rows:
            d = self._row_to_dict(row)
            # Extract video_count from progress_json
            try:
                pj = json.loads(d.get("progress_json", "{}"))
                d["video_count"] = len(pj.get("results", []))
            except (json.JSONDecodeError, TypeError):
                d["video_count"] = 0
            result.append(d)
        return result

    def delete_project(self, task_id: str) -> bool:
        cursor = self._conn.execute(
            "DELETE FROM projects WHERE id = ?", (task_id,)
        )
        self._conn.commit()
        return cursor.rowcount > 0

    def _row_to_dict(self, row: sqlite3.Row | None) -> dict:
        if row is None:
            return {}
        return dict(row)

    def close(self):
        self._conn.close()


# Module-level singleton
_store: ProjectStore | None = None


def get_project_store() -> ProjectStore:
    global _store
    if _store is None:
        from app.config import settings
        _store = ProjectStore(settings.output_dir / "projects.db")
    return _store
