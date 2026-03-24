import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.websocket import router as ws_router
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="YouTube Video Analyzer",
    description="Analyze YouTube videos, translate to Chinese, generate PPT",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    if not settings.openrouter_api_key:
        logger.warning("OPENROUTER_API_KEY is not set! Content analysis will fail.")
    logger.info(f"LLM model: {settings.llm_model}")

    # Initialize SQLite cache
    from app.utils.cache import get_cache
    get_cache()
    logger.info("Cache initialized")

    # Initialize project store and load existing projects into memory
    from app.utils.project_store import get_project_store
    get_project_store()
    from app.agents.orchestrator import load_projects_to_memory
    load_projects_to_memory()
    logger.info("Project store initialized")


@app.get("/health")
async def health():
    return {"status": "ok"}
