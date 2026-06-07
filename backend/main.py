"""
FastAPI application entry point.

Serves the Mirador demo SPA (built to dist-demo/) and the /api/chat backend.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.routers import chat

load_dotenv()  # Load .env if present (local dev); Docker uses env vars directly

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="Mirador Chat Plugin API",
    description=(
        "FastAPI backend for the mirador-chat-plugin. "
        "Uses LiteLLM to support OpenAI, Ollama, Anthropic, and any other provider."
    ),
    version="1.0.0",
)

# ── API routes ────────────────────────────────────────────────────────────────
app.include_router(chat.router)

# ── Static files (Vite-built SPA) ─────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent.parent / "dist-demo"

if STATIC_DIR.exists():
    # Mount assets (JS, CSS, images) under /assets
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        """Return index.html for all non-API routes so the SPA handles routing."""
        index = STATIC_DIR / "index.html"
        return FileResponse(str(index))
else:
    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {
            "message": (
                "API is running. "
                "Frontend not found — run `vite build --config vite.config.demo.js` first."
            )
        }
