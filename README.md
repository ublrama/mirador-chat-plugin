# mirador-chat-plugin

A [Mirador 4](https://github.com/ProjectMirador/mirador) plugin that adds an AI chat assistant companion window to every viewer window. Users can ask questions about the IIIF canvas they are currently viewing and receive streaming answers powered by any LLM provider via [LiteLLM](https://docs.litellm.ai/).

## Features

- **Chat button** in the window top-bar that opens a right-side companion window
- **Streaming responses** via Server-Sent Events (SSE) — tokens appear as they are generated, for all manifest types
- **Conversation memory** — the canvas image is sent once on the first question and retained in conversation history so follow-up questions can reference the same image without re-uploading it
- **Model selector** — dropdown in the chat header showing only the models whose API key is configured; users can switch model per session
- **Vision-model support** — sends a 512 px thumbnail of the current canvas image (never full resolution) to reduce cost and latency
- **Manifest metadata context** — optional toggle to include title, description, date, etc. as extra context
- **Scoped AI responses** — the assistant only answers questions directly about the visible image or provided metadata; off-topic questions are politely refused
- **Resizable panel** — drag the left edge to widen or narrow the chat window

---

## Quick start (Docker — recommended)

The repository ships a multi-stage `Dockerfile` that builds the Vite SPA and packages it together with the FastAPI backend into a single container.

### 1. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```ini
OPENAI_API_KEY=sk-...           # or any other provider key
LLM_MODEL=gpt-4o-mini           # any LiteLLM model string
```

### 2. Build and start

```bash
docker compose up --build
```

Open <http://localhost:8000>. The Mirador viewer loads with the chat plugin connected to the backend.

> **Note:** The `docker-compose.yml` passes all environment variables from `.env` directly into the container, so no rebuild is needed when you change API keys or the model.

---

## LLM providers

Set `LLM_MODEL` in `.env` to any [LiteLLM model string](https://docs.litellm.ai/docs/providers). The model selector in the chat UI automatically shows the providers whose key is present in `.env`.

| Provider                      | `LLM_MODEL` example                 | Credential variable |
|-------------------------------|-------------------------------------|---|
| OpenAI GPT -5.4 mini(default) | `gpt-5.4-mini`                      | `OPENAI_API_KEY` |
| Google Gemini                 | `gemini/gemini-3.5-flash`           | `GEMINI_API_KEY` |
| Ollama (external)             | `ollama/llama3`                     | `OLLAMA_API_BASE=http://host.docker.internal:11434` |

---

## Running Ollama in a sidecar container

No local Ollama installation is required. Docker Compose can spin up Ollama alongside the app.

**1. Add to `.env`:**

```ini
USE_OLLAMA=true
COMPOSE_PROFILES=ollama
OLLAMA_MODEL=qwen3-vl:4b   # any model from https://ollama.com/library
```

> When `USE_OLLAMA=false` (the default), leave `COMPOSE_PROFILES` commented out — the Ollama container will not be started.

**2. Start both services:**
```bash
docker compose up --build
```

The Ollama container pulls the chosen model on first start and caches the weights in the `ollama_data` volume — subsequent restarts skip the download.

```bash
# Watch the pull progress
docker compose logs -f ollama
```

> Chat requests will fail until the model pull completes. The app itself is reachable at <http://localhost:8000> immediately.

To switch models, update `OLLAMA_MODEL` in `.env` and restart:

```bash
docker compose down && docker compose up --build
```

To free the cached model weights:

```bash
docker compose down -v
```

---

## Running without Docker

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.12
- `pip`

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Configure environment

Create a `.env` file in the project root (the backend reads it automatically via `python-dotenv`):

```bash
cp .env.example .env
# edit .env — set at least one provider key and LLM_MODEL
```

### 4. Build the demo SPA

```bash
npm run build:demo
# outputs to dist-demo/
```

### 5. Start the backend (serves SPA + API on port 8000)

```bash
uvicorn backend.main:app --reload
```

Open <http://localhost:8000>.

> `--reload` enables hot-reloading of Python source changes. Omit it in production.

---

## Development (Vite dev server)

The Vite dev server gives you Hot Module Replacement for the frontend without needing to build the SPA first.

```bash
npm start
# Opens http://localhost:4444
```

To point the dev server at your local backend, create `demo/src/.env`:

```ini
VITE_API_ENDPOINT=http://localhost:8000/api/chat
```

A running backend is required — chat requests will fail without one.

### Running the backend alongside the dev server

Open a second terminal:

```bash
uvicorn backend.main:app --reload
# Backend on http://localhost:8000
# Frontend dev server on http://localhost:4444
```

### Available npm scripts

| Command | Description |
|---|---|
| `npm start` | Start the Vite dev server on port 4444 |
| `npm run build` | Build the plugin as an ES module library → `dist/` |
| `npm run build:demo` | Build the demo SPA → `dist-demo/` (used by Docker) |
| `npm run clean` | Remove `dist/` and `dist-demo/` |

---

## Backend API

Both endpoints return the same SSE stream format so the frontend can handle them identically.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/{item_id}/stream` | SSE stream — internal manifests |
| `POST` | `/api/chat/external` | SSE stream — external manifests |
| `GET`  | `/api/models` | Returns available models based on configured API keys |

Interactive API docs (Swagger UI): <http://localhost:8000/docs>

### Which endpoint is called?

The plugin inspects the loaded manifest URL:

- **Known/internal manifests** (Leiden domains) → `POST /api/chat/{item_id}/stream`
- **All other manifests** → `POST /api/chat/external`

Both endpoints now return a streaming SSE response — there is no longer a plain JSON path.

### Request body

Both endpoints accept the same fields (internal adds `session_id`):

```json
{
  "question": "What language is this text written in?",
  "scope": "canvas",
  "canvas_id": "https://…/canvas/1",
  "session_id": "abc123",
  "use_image_context": true,
  "use_metadata_context": false,
  "conversation_history": [
    {
      "role": "user",
      "content": [
        { "type": "text",      "text": "What do you see?" },
        { "type": "image_url", "image_url": { "url": "https://…/full/512,/0/default.jpg" } }
      ]
    },
    { "role": "assistant", "content": "I see a stone arch…" }
  ],
  "manifest_url": "https://…/manifest",
  "image_url": "https://…/full/full/0/default.jpg",
  "model": "gemini/gemini-2.5-flash"
}
```

> **Image normalisation:** the backend automatically replaces the IIIF size segment of `image_url` with `512,` before sending it to the LLM — the full-resolution URL is never forwarded.

> **Conversation memory:** the frontend embeds the canvas image into the first user turn of `conversation_history` so the model can answer follow-up questions about the same image without re-uploading it.

### SSE event schema

```
data: {"type": "start"}
data: {"type": "text_chunk", "content": "Here is what I see…"}
data: {"type": "text_chunk", "content": " a stone arch…"}
data: {"type": "done"}
data: {"type": "error", "message": "…"}   ← sent instead of done on failure
```

### `GET /api/models` response

```json
{
  "models": [
    { "id": "gpt-4o-mini",              "name": "GPT-4o Mini",        "provider": "OpenAI" },
    { "id": "gemini/gemini-2.5-flash",  "name": "Gemini 2.5 Flash",   "provider": "Google" }
  ],
  "default": "gemini/gemini-2.5-flash"
}
```

Only providers with an API key set in `.env` appear in the list.

### AI response scope

The assistant is instructed to **only answer questions about the image or metadata** currently on screen. Off-topic questions (e.g. general knowledge unrelated to the document) receive the response:

> *"I can only answer questions about the image or document currently on screen."*

---

## Opening a specific manifest via URL

Append a `manifest` query parameter to load a manifest directly:

```
http://localhost:8000/?manifest=https://catalogue.leidenuniv.nl/…/manifest
```

Optional parameters:

| Parameter | Description |
|---|---|
| `manifest` / `manifestId` | IIIF manifest URL to load |
| `canvasId` / `canvasID` | Jump to a specific canvas by ID |
| `collection` | Load a IIIF collection (clears `manifest` and `canvasId`) |

---

## Project structure

```
mirador-chat-plugin/
├── Dockerfile
├── docker-compose.yml
├── .env.example              ← copy to .env and fill in credentials
├── package.json
├── vite.config.js            ← library build (dist/)
├── vite.config.demo.js       ← demo SPA build (dist-demo/)
├── backend/
│   ├── main.py               ← FastAPI app; serves SPA + API
│   ├── requirements.txt
│   ├── routers/
│   │   └── chat.py           ← /api/models  &  both chat endpoints
│   └── services/
│       ├── llm.py            ← LiteLLM streaming helpers + IIIF URL normalisation
│       ├── manifest.py       ← IIIF manifest fetcher / text extractor
│       └── prompt_templates.py  ← system prompts (image / metadata-only / no-context)
├── demo/
│   └── src/
│       ├── index.html
│       └── index.js          ← demo viewer config; reads ?manifest= from URL
└── src/
    ├── index.js              ← plugin entry-point; exports miradorChatPlugin[]
    ├── ChatCompanionWindowContainer.jsx
    ├── state/
    │   └── action-types.js
    ├── components/
    │   ├── ChatComponent.jsx    ← model selector dropdown, metadata toggle
    │   ├── ChatInput.jsx
    │   ├── ChatMessage.jsx
    │   ├── ChatTopBarButton.jsx
    │   ├── EvidenceItem.jsx
    │   ├── EvidencePanel.jsx
    │   ├── ScopeSelector.jsx
    │   └── StreamingMessage.jsx
    └── hooks/
        ├── useCanvasNavigation.js
        └── useConversation.js   ← SSE streaming, conversation memory, image history
```

---

## License

Apache-2.0
