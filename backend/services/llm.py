"""
LiteLLM wrapper for the Mirador chat backend.

Model selection (in priority order):
1. ``LLM_MODEL`` environment variable (e.g. "ollama/llama3", "anthropic/claude-3-haiku-20240307")
2. Falls back to ``gpt-4o-mini`` (OpenAI) when not set.

For OpenAI, set ``OPENAI_API_KEY``.
For other providers, consult the LiteLLM docs:
https://docs.litellm.ai/docs/providers
"""

import os
from typing import AsyncIterator

import litellm

# Silence LiteLLM's verbose logging unless the caller opts in.
litellm.set_verbose = os.getenv("LITELLM_VERBOSE", "false").lower() == "true"

DEFAULT_MODEL = "gpt-4o-mini"


def _model() -> str:
    return os.getenv("LLM_MODEL", DEFAULT_MODEL)


def _build_messages(
    question: str,
    context: str,
    conversation_history: list[dict] | None = None,
    image_url: str | None = None,
) -> list[dict]:
    """Build the OpenAI-compatible messages list."""
    system_prompt = (
        "You are a helpful assistant that answers questions about IIIF manifests "
        "and their content. Answer concisely and accurately based on the provided context. "
        "If the context does not contain enough information to answer, say so."
    )

    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # Inject manifest context as a system-level message so it doesn't pollute
    # the conversation history that's shown to the user.
    if context:
        messages.append(
            {
                "role": "system",
                "content": f"Manifest context:\n{context}",
            }
        )

    # Re-inject previous turns
    if conversation_history:
        messages.extend(conversation_history)

    # Build the user content: plain text or vision array
    if image_url:
        user_content: str | list = [
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
    else:
        user_content = question

    messages.append({"role": "user", "content": user_content})
    return messages


async def stream_answer(
    question: str,
    context: str = "",
    conversation_history: list[dict] | None = None,
    image_url: str | None = None,
) -> AsyncIterator[str]:
    """
    Yield text delta strings from the LLM via LiteLLM streaming.
    Raises on non-retriable errors so the caller can send an SSE error event.
    """
    messages = _build_messages(question, context, conversation_history, image_url)

    response = await litellm.acompletion(
        model=_model(),
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
) -> str:
    """
    Return a single (non-streaming) answer string.
    Used for the /external endpoint which returns plain JSON.
    """
    messages = _build_messages(question, context, conversation_history, image_url)

    response = await litellm.acompletion(
        model=_model(),
        messages=messages,
        stream=False,
    )
    return response.choices[0].message.content or ""
