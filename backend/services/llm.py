"""
LiteLLM wrapper for the Mirador chat backend.

Model selection (in priority order):
1. ``USE_OLLAMA=true`` – uses the containerised Ollama service.
   ``OLLAMA_MODEL`` sets the model name (default: ``qwen3-vl:4b``).
   ``OLLAMA_API_BASE`` sets the Ollama URL (default: ``http://ollama:11434``).
2. ``LLM_MODEL`` environment variable (e.g. "anthropic/claude-3-haiku-20240307")
3. Falls back to ``gpt-4o-mini`` (OpenAI) when nothing is set.

For OpenAI, set ``OPENAI_API_KEY``.
For other providers, consult the LiteLLM docs:
https://docs.litellm.ai/docs/providers
"""

import logging
import os
import re
from typing import AsyncIterator

import litellm

logger = logging.getLogger(__name__)

from backend.services.prompt_templates import build_messages

# Silence LiteLLM's verbose logging unless the caller opts in.
litellm.set_verbose = os.getenv("LITELLM_VERBOSE", "false").lower() == "true"

DEFAULT_MODEL = "gpt-5.4-mini"
DEFAULT_OLLAMA_MODEL = "qwen3-vl:4b"
DEFAULT_OLLAMA_API_BASE = "http://ollama:11434"

# ── IIIF image normalisation ──────────────────────────────────────────────────
_IIIF_IMAGE_PARAMS = "/full/512,/0/default.jpg"
_IIIF_TAIL_RE = re.compile(r"(/[^/]+){3}/[^/.]+\.[a-z]+$", re.IGNORECASE)


def _normalise_image_url(url: str | None) -> str | None:
    """Replace IIIF image request parameters with a 512-px thumbnail spec."""
    if not url:
        return url
    normalised = _IIIF_TAIL_RE.sub(_IIIF_IMAGE_PARAMS, url)
    if normalised == url and not url.rstrip("/").endswith(_IIIF_IMAGE_PARAMS):
        normalised = url.rstrip("/") + _IIIF_IMAGE_PARAMS
    return normalised


def _model() -> str:
    """Return the LiteLLM model string to use for this request.

    When ``USE_OLLAMA=true`` the model is always ``ollama/<OLLAMA_MODEL>``.
    ``OLLAMA_API_BASE`` is also defaulted to the internal Docker service name
    (``http://ollama:11434``) if not already set by the caller.
    """
    if os.getenv("USE_OLLAMA", "false").lower() == "true":
        # Default the Ollama URL to the containerised service unless the user
        # has already pointed it at an external instance.
        if not os.getenv("OLLAMA_API_BASE"):
            os.environ["OLLAMA_API_BASE"] = DEFAULT_OLLAMA_API_BASE
        ollama_model = os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
        return f"ollama/{ollama_model}"
    return os.getenv("LLM_MODEL", DEFAULT_MODEL)


def _build_messages(
    question: str,
    context: str,
    conversation_history: list[dict] | None = None,
    image_url: str | None = None,
) -> list[dict]:
    """Build the OpenAI-compatible messages list. ``image_url`` must already be normalised."""
    return build_messages(
        question,
        image_url=image_url,
        metadata=context or None,
        conversation_history=conversation_history,
    )


async def stream_answer(
    question: str,
    context: str = "",
    conversation_history: list[dict] | None = None,
    image_url: str | None = None,
    model: str | None = None,
) -> AsyncIterator[str]:
    """
    Yield text delta strings from the LLM via LiteLLM streaming.
    Raises on non-retriable errors so the caller can send an SSE error event.
    ``model`` overrides the server-configured default when supplied.
    """
    resolved_model = model or _model()
    normalised_image = _normalise_image_url(image_url)
    logger.info(
        "stream_answer | model=%s | image original=%s | image sent=%s",
        resolved_model, image_url, normalised_image,
    )
    messages = _build_messages(question, context, conversation_history, normalised_image)

    response = await litellm.acompletion(
        model=resolved_model,
        messages=messages,
        stream=True,
    )

    async for chunk in response:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield delta


async def complete_answer(
    question: str,
    context: str = "",
    conversation_history: list[dict] | None = None,
    image_url: str | None = None,
    model: str | None = None,
) -> str:
    """
    Return a single (non-streaming) answer string.
    Used for the /external endpoint which returns plain JSON.
    ``model`` overrides the server-configured default when supplied.
    """
    resolved_model = model or _model()
    normalised_image = _normalise_image_url(image_url)
    logger.info(
        "complete_answer | model=%s | image original=%s | image sent=%s",
        resolved_model, image_url, normalised_image,
    )
    messages = _build_messages(question, context, conversation_history, normalised_image)

    response = await litellm.acompletion(
        model=resolved_model,
        messages=messages,
        stream=False,
    )
    return response.choices[0].message.content or ""
