import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.agents.orchestrator import get_task

logger = logging.getLogger(__name__)
router = APIRouter()

# Active WebSocket connections per task
_connections: dict[str, list[WebSocket]] = {}


def get_connections(task_id: str) -> list[WebSocket]:
    return _connections.get(task_id, [])


async def broadcast_to_task(task_id: str, data: dict):
    """Broadcast progress update to all WebSocket connections for a task."""
    connections = _connections.get(task_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)


@router.websocket("/ws/tasks/{task_id}")
async def websocket_task_progress(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for real-time task progress updates."""
    await websocket.accept()

    if task_id not in _connections:
        _connections[task_id] = []
    _connections[task_id].append(websocket)

    logger.info(f"WebSocket connected for task {task_id}")

    try:
        # Send current state immediately
        task = get_task(task_id)
        if task:
            await websocket.send_json(task.model_dump())

        # Keep connection alive and poll for updates
        while True:
            try:
                # Wait for client messages (ping/pong) or timeout
                data = await asyncio.wait_for(
                    websocket.receive_text(), timeout=2.0
                )
            except asyncio.TimeoutError:
                # Send heartbeat with current state
                task = get_task(task_id)
                if task:
                    await websocket.send_json(task.model_dump())
                    if task.status in ("completed", "failed"):
                        break
            except WebSocketDisconnect:
                break

    except WebSocketDisconnect:
        pass
    finally:
        if task_id in _connections and websocket in _connections[task_id]:
            _connections[task_id].remove(websocket)
        logger.info(f"WebSocket disconnected for task {task_id}")
