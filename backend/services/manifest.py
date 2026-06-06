"""
Utility functions for fetching and extracting text from IIIF manifests.
"""

from urllib.parse import urlparse

import httpx


# Allowed URL schemes for manifest fetching
_ALLOWED_SCHEMES = {"http", "https"}


def _validate_manifest_url(url: str) -> None:
    """
    Raise ValueError if the URL is not a safe http/https URL.
    Prevents SSRF by rejecting file://, ftp://, and internal-only addresses
    that could be reached from inside the container.
    """
    parsed = urlparse(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError(f"Manifest URL scheme not allowed: {parsed.scheme!r}")
    if not parsed.netloc:
        raise ValueError("Manifest URL has no host")


async def fetch_manifest(manifest_url: str) -> dict:
    """Fetch and return a parsed IIIF manifest JSON."""
    _validate_manifest_url(manifest_url)
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(manifest_url)
        response.raise_for_status()
        return response.json()


def extract_manifest_text(manifest: dict) -> str:
    """
    Extract a plain-text summary of the manifest suitable for LLM context.
    Handles both IIIF Presentation API 2 and 3.
    """
    parts: list[str] = []

    def _lang_value(value) -> str:
        """
        Resolve an IIIF language map or plain string to a single plain string.

        Handles:
        - Plain strings (returned as-is).
        - IIIF 2 arrays: list of ``{"@value": "...", "@language": "..."}`` dicts
          or plain strings.
        - IIIF 3 language maps: ``{"en": ["..."], "nl": ["..."]}`` dicts.
        """
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            # IIIF 2 style: list of {"@value": "...", "@language": "..."} or plain strings
            texts = []
            for item in value:
                if isinstance(item, str):
                    texts.append(item)
                elif isinstance(item, dict):
                    texts.append(item.get("@value") or item.get("value") or "")
            return " ".join(filter(None, texts))
        if isinstance(value, dict):
            # IIIF 3 style: {"en": ["..."]}
            for lang_values in value.values():
                if isinstance(lang_values, list) and lang_values:
                    return lang_values[0]
        return ""

    # Label
    label = _lang_value(manifest.get("label") or manifest.get("@label") or "")
    if label:
        parts.append(f"Title: {label}")

    # Description / summary
    for key in ("description", "summary", "@description"):
        desc = _lang_value(manifest.get(key) or "")
        if desc:
            parts.append(f"Description: {desc}")
            break

    # Metadata key-value pairs
    for meta in manifest.get("metadata") or []:
        key = _lang_value(meta.get("label") or "")
        val = _lang_value(meta.get("value") or "")
        if key and val:
            parts.append(f"{key}: {val}")

    # Canvas labels
    canvases = (
        manifest.get("sequences", [{}])[0].get("canvases", [])  # IIIF 2
        if "sequences" in manifest
        else manifest.get("items", [])  # IIIF 3
    )
    canvas_labels = []
    for canvas in canvases[:20]:  # cap to first 20 canvases
        clabel = _lang_value(canvas.get("label") or "")
        if clabel:
            canvas_labels.append(clabel)
    if canvas_labels:
        parts.append("Pages/Canvases: " + "; ".join(canvas_labels))

    return "\n".join(parts)
