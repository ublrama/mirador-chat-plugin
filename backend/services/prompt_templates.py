"""
Prompt templates for the Mirador Chat Plugin backend.

This application lets users ask questions about the IIIF canvas they are
currently viewing in Mirador.  The AI assistant may receive:

  • The current canvas image (vision models, via image_url)
  • Manifest metadata (title, description, date, provider, etc.)
  • Conversation history from the current session

All templates are designed for this visual/contextual Q&A scenario.
"""

from typing import Optional

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_IMAGE = """\
You are a specialist assistant embedded in a Mirador IIIF viewer. \
The user is examining a specific canvas from a historical or cultural-heritage document. \
Your sole purpose is to answer questions about what is visible in the provided image \
and any accompanying manifest metadata.

Rules:
- ONLY answer questions that are directly about the image or the metadata provided.
- If a question is not about the image or metadata (e.g. general knowledge, \
  unrelated topics, hypothetical scenarios), respond with exactly: \
  "I can only answer questions about the image or document currently on screen."
- Base every answer strictly on what is visible in the image or stated in the metadata.
- Do not invent, infer, or supplement with outside knowledge.
- If you cannot determine something from the image or metadata, say so clearly.
- Be concise and direct; avoid unnecessary padding.
- Respond in the same language the user writes in.\
"""

SYSTEM_PROMPT_METADATA_ONLY = """\
You are a specialist assistant embedded in a Mirador IIIF viewer. \
No image is available for the current canvas, but manifest metadata has been provided. \
Your sole purpose is to answer questions about that metadata.

Rules:
- ONLY answer questions that are directly about the provided metadata.
- If a question cannot be answered from the metadata, respond with exactly: \
  "I can only answer questions about the image or document currently on screen."
- Do not use outside knowledge to supplement the metadata.
- If the metadata does not contain the answer, say so clearly.
- Be concise and direct.
- Respond in the same language the user writes in.\
"""

SYSTEM_PROMPT_NO_CONTEXT = """\
You are an assistant embedded in a Mirador IIIF viewer. \
No image or metadata is currently available for this canvas. \
You cannot answer questions about the document because no context has been provided. \
For every question, respond with: \
"No image or metadata is available for this canvas. \
Please navigate to a canvas and enable image or metadata context to ask questions about it."\
"""


def build_system_prompt(
    has_image: bool,
    metadata: Optional[str] = None,
) -> str:
    """
    Choose the right system prompt and append metadata when available.

    Args:
        has_image:  True when an image_url is included in the user message.
        metadata:   Optional string of manifest metadata (title, description, …).

    Returns:
        A complete system-prompt string.
    """
    if has_image:
        prompt = SYSTEM_PROMPT_IMAGE
    elif metadata:
        prompt = SYSTEM_PROMPT_METADATA_ONLY
    else:
        prompt = SYSTEM_PROMPT_NO_CONTEXT

    if metadata:
        prompt += (
            "\n\n---\n"
            "**Manifest metadata provided by the viewer:**\n\n"
            + metadata.strip()
        )

    return prompt


# ---------------------------------------------------------------------------
# Message builder
# ---------------------------------------------------------------------------

def build_messages(
    question: str,
    *,
    image_url: Optional[str] = None,
    metadata: Optional[str] = None,
    conversation_history: Optional[list[dict]] = None,
) -> list[dict]:
    """
    Build an OpenAI-compatible message list for a single user turn.

    The first message is always the system prompt (with optional metadata).
    Any previous conversation turns are replayed next so the model retains
    context.  The final message is the current user question, optionally
    accompanied by the canvas image for vision models.

    Args:
        question:             The user's question text.
        image_url:            IIIF image URL of the current canvas (optional).
                              When supplied the user message is multimodal.
        metadata:             Extracted manifest metadata string (optional).
        conversation_history: Previous ``[{"role": …, "content": …}]`` turns.
                              The image is expected to already be embedded in
                              the first user turn of the history (see
                              ``useConversation.js`` – ``buildHistory``).

    Returns:
        A list of message dicts ready for ``litellm.acompletion``.

    Example (first question, with image)::

        messages = build_messages(
            question="What language is this text written in?",
            image_url="https://example.org/iiif/canvas/1/full/800,/0/default.jpg",
        )

    Example (follow-up, image already in history)::

        messages = build_messages(
            question="Can you tell me more about the seal?",
            conversation_history=[
                {"role": "user",      "content": [text_part, image_part]},
                {"role": "assistant", "content": "This appears to be…"},
            ],
        )
    """
    has_image = bool(image_url)
    system_content = build_system_prompt(has_image=has_image, metadata=metadata)

    messages: list[dict] = [{"role": "system", "content": system_content}]

    # Replay conversation history (image already embedded in the first turn
    # by the frontend's buildHistory helper).
    if conversation_history:
        for turn in conversation_history:
            role = turn.get("role", "")
            content = turn.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    # Current user message — multimodal if an image URL is provided.
    if image_url:
        user_content: str | list = [
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]
    else:
        user_content = question

    messages.append({"role": "user", "content": user_content})
    return messages
