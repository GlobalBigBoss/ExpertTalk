import asyncio
import logging
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import settings
from app.models.schemas import TaskCreate, TaskProgress
from app.agents.orchestrator import create_task, get_task, process_task
from app.agents.video_fetcher import check_video_accessible
from app.api.websocket import broadcast_to_task
from app.utils.project_store import get_project_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


@router.post("/tasks", response_model=dict)
async def create_analysis_task(body: TaskCreate):
    """Create a new video analysis task."""
    task_id = create_task(
        video_url=body.video_url,
        max_depth=body.max_depth,
        max_videos_per_person=body.max_videos_per_person,
    )

    # Start processing in background with WebSocket callback
    async def ws_callback(data: dict):
        await broadcast_to_task(task_id, data)

    asyncio.create_task(
        process_task(
            task_id=task_id,
            video_url=body.video_url,
            max_depth=body.max_depth,
            max_videos_per_person=body.max_videos_per_person,
            ws_callback=ws_callback,
        )
    )

    return {"task_id": task_id, "status": "pending"}


@router.get("/tasks/{task_id}", response_model=TaskProgress)
async def get_task_status(task_id: str):
    """Get the current status and results of a task."""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/tasks/{task_id}/download/{video_id}")
async def download_ppt(task_id: str, video_id: str):
    """Download the generated PPT for a specific video."""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Find the video result
    for result in task.results:
        if result.video_id == video_id and result.ppt_filename:
            filepath = settings.output_dir / result.ppt_filename
            if filepath.exists():
                return FileResponse(
                    path=str(filepath),
                    filename=result.ppt_filename,
                    media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                )

    raise HTTPException(status_code=404, detail="PPT file not found")


@router.get("/tasks/{task_id}/download/{video_id}/pdf")
async def download_pdf(task_id: str, video_id: str):
    """Download the generated PPT as PDF for a specific video."""
    from app.utils.pdf_converter import convert_pptx_to_pdf

    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for result in task.results:
        if result.video_id == video_id and result.ppt_filename:
            pptx_path = settings.output_dir / result.ppt_filename
            if not pptx_path.exists():
                raise HTTPException(status_code=404, detail="PPT file not found")

            try:
                pdf_path = await asyncio.to_thread(convert_pptx_to_pdf, pptx_path)
                return FileResponse(
                    path=str(pdf_path),
                    filename=pdf_path.name,
                    media_type="application/pdf",
                )
            except RuntimeError as e:
                raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=404, detail="PPT file not found")


@router.get("/projects")
async def list_projects():
    """List all projects, ordered by most recently updated."""
    store = get_project_store()
    projects = store.list_projects()
    # Return summary without full progress_json
    return [
        {
            "id": p["id"],
            "video_url": p["video_url"],
            "title": p["title"],
            "title_cn": p["title_cn"],
            "status": p["status"],
            "created_at": p["created_at"],
            "updated_at": p["updated_at"],
            "video_count": p.get("video_count", 0),
        }
        for p in projects
    ]


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get full project details. Returns in-memory version if task is active."""
    # Prefer in-memory task (has real-time progress)
    task = get_task(project_id)
    if task:
        return task

    # Fall back to SQLite
    import json
    store = get_project_store()
    proj = store.get_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        progress_data = json.loads(proj.get("progress_json", "{}"))
        if progress_data and progress_data.get("task_id"):
            return progress_data
    except (json.JSONDecodeError, TypeError):
        pass

    # Minimal fallback
    return {
        "task_id": project_id,
        "status": proj.get("status", "unknown"),
        "current_step": "",
        "progress_pct": 100 if proj.get("status") == "completed" else 0,
        "total_videos": 0,
        "processed_videos": 0,
        "results": [],
        "error": "",
        "steps": [],
    }


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    store = get_project_store()
    deleted = store.delete_project(project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted"}


@router.get("/test-video")
async def test_video_access(url: str = Query(..., description="YouTube video URL to test")):
    """Quick check if a YouTube video URL is accessible via yt-dlp."""
    try:
        result = await asyncio.to_thread(check_video_accessible, url)
        return result
    except Exception as e:
        return {
            "accessible": False,
            "error": f"{type(e).__name__}: {e}",
            "hint": "If you are in China, set HTTP_PROXY in .env (e.g. HTTP_PROXY=http://127.0.0.1:7890)",
        }


def _test_url(url: str, proxy: str | None, timeout: int = 8) -> dict:
    """Test HTTP connectivity to a URL. Returns status and latency."""
    try:
        req = Request(url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0")
        if proxy:
            from urllib.request import ProxyHandler, build_opener
            opener = build_opener(ProxyHandler({"http": proxy, "https": proxy}))
            t0 = time.monotonic()
            resp = opener.open(req, timeout=timeout)
        else:
            t0 = time.monotonic()
            resp = urlopen(req, timeout=timeout)
        latency = round((time.monotonic() - t0) * 1000)
        return {"status": "ok", "latency_ms": latency, "http_code": resp.status}
    except Exception as e:
        return {"status": "fail", "error": f"{type(e).__name__}: {e}"}


def _test_ytdlp(proxy: str | None) -> dict:
    """Test yt-dlp can extract info from a known short video."""
    import yt_dlp
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    if proxy:
        opts["proxy"] = proxy
    try:
        t0 = time.monotonic()
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info("https://www.youtube.com/watch?v=jNQXAC9IVRw", download=False)
        latency = round((time.monotonic() - t0) * 1000)
        return {"status": "ok", "latency_ms": latency, "title": info.get("title", "")}
    except Exception as e:
        return {"status": "fail", "error": f"{type(e).__name__}: {e}"}


@router.get("/test-connectivity")
async def test_connectivity():
    """Test YouTube/Google connectivity and proxy configuration."""
    proxy = settings.http_proxy or None

    results: dict = {
        "proxy": settings.http_proxy or "未配置",
    }

    # Run all tests in parallel threads
    google_fut = asyncio.to_thread(_test_url, "https://www.google.com", proxy)
    youtube_fut = asyncio.to_thread(_test_url, "https://www.youtube.com", proxy)
    ytdlp_fut = asyncio.to_thread(_test_ytdlp, proxy)

    google_res, youtube_res, ytdlp_res = await asyncio.gather(
        google_fut, youtube_fut, ytdlp_fut, return_exceptions=True
    )

    results["google"] = google_res if isinstance(google_res, dict) else {"status": "fail", "error": str(google_res)}
    results["youtube"] = youtube_res if isinstance(youtube_res, dict) else {"status": "fail", "error": str(youtube_res)}
    results["ytdlp"] = ytdlp_res if isinstance(ytdlp_res, dict) else {"status": "fail", "error": str(ytdlp_res)}

    return results
