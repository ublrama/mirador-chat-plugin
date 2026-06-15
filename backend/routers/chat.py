"""
Chat router — exposes the two endpoint shapes the frontend plugin expects:

  GET  /api/models                  → list of available models (API keys present)
  POST /api/chat/{item_id}/stream   → SSE stream (internal manifests)
  POST /api/chat/external           → plain JSON  (external manifests)
"""

import asyncio
import json
import logging
import os
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services import llm, manifest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ── Available models registry ─────────────────────────────────────────────────
# Each entry: (env_var_that_must_be_set, list_of_model_dicts)
# Models are only surfaced to the UI when the corresponding key is present.

_PROVIDER_MODELS = [
    ("OPENAI_API_KEY", [
        {"id": "gpt-5.4-mini",  "name": "GPT-5.4 Mini",  "provider": "OpenAI"},
    ]),
    ("GEMINI_API_KEY", [
        {"id": "gemini/gemini-3.5-flash", "name": "Gemini 3.5 Flash", "provider": "Google"},
    ])
]


@router.get("/models")
async def list_models() -> dict:
    """
    Return the models available based on which API keys are configured.
    Also includes the Ollama model when USE_OLLAMA=true.
    The ``default`` field reflects the currently active LLM_MODEL setting.
    """
    available: list[dict] = []

    for env_var, models in _PROVIDER_MODELS:
        if os.getenv(env_var):
            available.extend(models)

    # Ollama (containerised or external)
    if os.getenv("USE_OLLAMA", "false").lower() == "true" or os.getenv("OLLAMA_API_BASE"):
        ollama_model = os.getenv("OLLAMA_MODEL", llm.DEFAULT_OLLAMA_MODEL)
        available.append({
            "id": f"ollama/{ollama_model}",
            "name": f"Ollama – {ollama_model}",
            "provider": "Ollama",
        })

    default_model = llm._model()

    return {"models": available, "default": default_model}


# ── Request models ────────────────────────────────────────────────────────────


class StreamRequest(BaseModel):
    question: str
    scope: str = "manifest"
    canvas_id: str | None = None
    session_id: str | None = None
    use_image_context: bool = False
    use_metadata_context: bool = False
    conversation_history: list[dict] = []
    manifest_url: str | None = None  # set by the demo when it injects the URL
    image_url: str | None = None     # current canvas image URL (for vision models)
    model: str | None = None         # override the server default model


class ExternalRequest(BaseModel):
    manifest_url: str
    question: str
    scope: str = "manifest"
    canvas_id: str | None = None
    use_image_context: bool = False
    use_metadata_context: bool = False
    image_url: str | None = None      # current canvas image URL (for vision models)
    model: str | None = None          # override the server default model
    conversation_history: list[dict] = []


# ── SSE helpers ───────────────────────────────────────────────────────────────


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def _stream_sse(
    question: str,
    context: str,
    conversation_history: list[dict],
    image_url: str | None,
    model: str | None = None,
) -> AsyncIterator[str]:
    """Async generator that yields SSE-formatted strings."""
    yield _sse({"type": "start"})
    await asyncio.sleep(0)  # let the response headers flush

    try:
        async for delta in llm.stream_answer(
            question=question,
            context=context,
            conversation_history=conversation_history,
            image_url=image_url,
            model=model,
        ):
            yield _sse({"type": "text_chunk", "content": delta})

        yield _sse({"type": "done"})

    except Exception:  # noqa: BLE001
        logger.exception("LLM streaming error")
        yield _sse({"type": "error", "message": "An error occurred while generating the answer. Please try again."})


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/chat/{item_id}/stream")
async def stream_endpoint(item_id: str, body: StreamRequest) -> StreamingResponse:
    """
    Streaming SSE endpoint for internal (Leiden) manifests.
    ``item_id`` is the local item identifier extracted by the frontend.
    If ``body.manifest_url`` is supplied it is used to fetch manifest context.
    """
    context = ""
    if body.use_metadata_context and body.manifest_url:
        try:
            raw = await manifest.fetch_manifest(body.manifest_url)
            context = manifest.extract_manifest_text(raw)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch manifest %s: %s", body.manifest_url, exc)

    return StreamingResponse(
        _stream_sse(
            question=body.question,
            context=context,
            conversation_history=body.conversation_history,
            image_url=body.image_url if body.use_image_context else None,
            model=body.model,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable Nginx buffering if behind a proxy
        },
    )


@router.post("/chat/external")
async def external_endpoint(body: ExternalRequest) -> StreamingResponse:
    """
    Streaming SSE endpoint for external IIIF manifests.
    Returns the same SSE event format as the internal /stream endpoint so the
    frontend can handle both paths identically.
    """
    context = ""
    if body.use_metadata_context:
        try:
            raw = await manifest.fetch_manifest(body.manifest_url)
            context = manifest.extract_manifest_text(raw)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch manifest %s: %s", body.manifest_url, exc)

    return StreamingResponse(
        _stream_sse(
            question=body.question,
            context=context,
            conversation_history=body.conversation_history,
            image_url=body.image_url if body.use_image_context else None,
            model=body.model,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

