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
You are an expert assistant embedded in a Mirador IIIF viewer. \
The user is looking at a specific page or canvas from a historical or cultural-heritage \
document and may ask anything about what they see: the content, language, subject matter, \
people, places, dates, writing style, artwork, or anything else visible in the image.

Rules:
- Base your answers on the image and any metadata provided.
- Be concise and direct; avoid unnecessary padding.
- If you cannot determine something from the image, say so clearly.
- Do not invent details that are not visible or stated.
- When metadata is provided, you may combine it with what you see in the image.
- Respond in the same language the user writes in.\
"""

SYSTEM_PROMPT_METADATA_ONLY = """\
You are an expert assistant embedded in a Mirador IIIF viewer. \
No image is available for the current canvas, but manifest metadata has been provided. \
Answer the user's question based solely on that metadata.

Rules:
- Only use information present in the provided metadata.
- If the metadata does not contain the answer, say so clearly.
- Be concise and direct.
- Respond in the same language the user writes in.\
"""

SYSTEM_PROMPT_NO_CONTEXT = """\
You are an expert assistant embedded in a Mirador IIIF viewer. \
No image or metadata is currently available for this canvas. \
Answer general questions about IIIF, the viewer, or the type of content the user might be viewing, \
but clearly state when you are speaking from general knowledge rather than the actual document.\
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
