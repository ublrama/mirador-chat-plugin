"""
Chat router — exposes the two endpoint shapes the frontend plugin expects:

  POST /api/chat/{item_id}/stream   → SSE stream (internal manifests)
  POST /api/chat/external           → plain JSON  (external manifests)
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.services import llm, manifest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat")


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


class ExternalRequest(BaseModel):
    manifest_url: str
    question: str
    scope: str = "manifest"
    canvas_id: str | None = None
    use_image_context: bool = False
    use_metadata_context: bool = False


# ── SSE helpers ───────────────────────────────────────────────────────────────


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def _stream_sse(
    question: str,
    context: str,
    conversation_history: list[dict],
    image_url: str | None,
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
        ):
            yield _sse({"type": "text_chunk", "content": delta})

        yield _sse({"type": "done"})

    except Exception:  # noqa: BLE001
        logger.exception("LLM streaming error")
        yield _sse({"type": "error", "message": "An error occurred while generating the answer. Please try again."})


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/{item_id}/stream")
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
            image_url=None,  # image context not supported on the SSE path yet
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable Nginx buffering if behind a proxy
        },
    )


@router.post("/external")
async def external_endpoint(body: ExternalRequest) -> dict:
    """
    Non-streaming JSON endpoint for external IIIF manifests.
    Returns ``{"answer": "...", "evidence": []}``.
    """
    context = ""
    if body.use_metadata_context:
        try:
            raw = await manifest.fetch_manifest(body.manifest_url)
            context = manifest.extract_manifest_text(raw)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch manifest %s: %s", body.manifest_url, exc)

    answer = await llm.complete_answer(
        question=body.question,
        context=context,
    )

    return {"answer": answer, "evidence": []}
