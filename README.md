# mirador-chat-plugin

A [Mirador 4](https://github.com/ProjectMirador/mirador) plugin that adds an AI chat assistant companion window to every viewer window. Users can ask questions about the loaded IIIF manifest and receive streaming answers with annotation-based evidence links.

## Features

- **Chat button** in the window top-bar that toggles a right-side companion window
- **Streaming responses** via Server-Sent Events (SSE) from your own backend
- **Evidence panel** linking AI answers back to canvas annotations
- **Scope selector** – search across the entire manifest or restrict to the current canvas
- **Image & metadata context** toggles that enrich the prompt sent to the LLM
- **WebLLM in-browser mode** – run inference entirely in the browser via WebGPU (no backend required)
- **Mock API fallback** – the plugin works out of the box without a backend

## Installation

```bash
npm install mirador-chat-plugin
```

### Peer dependencies

Make sure the following packages are already installed in the host app:

| Package | Version |
|---|---|
| `mirador` | `^4.0.0` |
| `react` | `^18 || ^19` |
| `react-dom` | `^18 || ^19` |
| `@mui/material` | `^7.0.0` |
| `@mui/icons-material` | `^7.0.0` |
| `@mui/system` | `^7.0.0` |
| `@emotion/react` | `^11` |
| `@emotion/styled` | `^11` |
| `prop-types` | `^15` |

## Usage

```js
import Mirador from 'mirador';
import miradorChatPlugin from 'mirador-chat-plugin';

Mirador.viewer(
  { id: 'viewer', windows: [{ loadedManifest: '...' }] },
  [...miradorChatPlugin]
);
```

### Backend configuration

Set `VITE_API_ENDPOINT` (or the equivalent runtime env var) to the root URL of your chat backend.

```
VITE_API_ENDPOINT=https://your-backend.example.com/api/chat
```

The plugin expects the backend to:

- **Internal manifests** – `POST <endpoint>/<item-id>/stream` returning an SSE stream with events of type `start`, `text_chunk`, `evidence`, and `done`.
- **External manifests** – `POST <endpoint>/external` returning a plain JSON response `{ answer, evidence[] }`.

When the backend is unreachable the plugin automatically falls back to the built-in mock streaming API.

### WebLLM in-browser mode

The plugin optionally supports fully in-browser AI inference powered by [WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU. In this mode no backend server is required: the model runs locally on the user's GPU.

Enable it by setting two environment variables before building or starting the dev server:

```
VITE_WEBLLM_ENABLED=true
VITE_WEBLLM_MODEL=Llama-3.2-1B-Instruct-q4f16_1-MLC
```

When enabled the chat header shows a **Load model** button. Clicking it downloads the model weights (cached in the browser after the first load) and starts the engine. Subsequent questions are answered locally without any network call.

You can also use a vision-capable model to send the current canvas image alongside the question:

```
VITE_WEBLLM_MODEL=Llama-3.2-11B-Vision-Instruct-q4f16_1-MLC
```

Then enable the **Use image as context** toggle in the chat header.

#### Browser requirements

| Requirement | Notes |
|---|---|
| **WebGPU** | Chrome 113+, Edge 113+, Chrome/Edge on Android 125+. Firefox and Safari have limited/no support. |
| **GPU VRAM** | ~500 MB for 1 B models; ~4–7 GB for 7–11 B vision models. Integrated GPUs may struggle with larger models. |

If WebGPU is not available the banner shows a "WebGPU not available – using backend" message and the plugin falls back to the normal backend/mock path automatically.

#### Limitations of in-browser mode

- **No evidence panel** – the local model cannot perform retrieval-augmented generation (RAG), so the evidence sidebar will be empty. Evidence links are only available when using the backend path.
- **First-load download** – model weights are large (0.5 GB to 7+ GB). The weights are cached via the browser's Cache Storage, so subsequent loads are instant.
- **CORS on IIIF images** – when using a vision model with **Use image as context**, the IIIF image server must send permissive `Access-Control-Allow-Origin` headers so the browser can fetch the image.

## Docker — all-in-one container

The repository ships a multi-stage `Dockerfile` that packages the Mirador SPA
**and** a FastAPI backend into a single container image. The backend uses
[LiteLLM](https://docs.litellm.ai/) so you can point it at any LLM provider
without changing code.

### Quick start

```bash
# 1. Copy the environment template and fill in your API key
cp .env.example .env
# edit .env: set OPENAI_API_KEY (and optionally LLM_MODEL)

# 2. Build and run
docker compose up --build
```

Open <http://localhost:8000> — Mirador loads with the chat plugin connected to
the backend.

### Choosing a model

Set `LLM_MODEL` in `.env` to any
[LiteLLM model string](https://docs.litellm.ai/docs/providers):

| Provider | Example value |
|---|---|
| OpenAI (default) | `gpt-4o-mini` |
| OpenAI GPT-4o | `gpt-4o` |
| Anthropic Claude | `anthropic/claude-3-haiku-20240307` |
| Ollama (local) | `ollama/llama3` |
| Azure OpenAI | `azure/<your-deployment>` |

For Ollama, make sure `OLLAMA_API_BASE` points to your running instance
(default: `http://host.docker.internal:11434`).

### Running Ollama in a container

You can run Ollama as a sidecar container — no local Ollama installation
required. The container pulls the chosen model on first start and caches
the weights in a Docker volume so subsequent restarts are instant.

**1. Enable the feature in `.env`:**

```ini
USE_OLLAMA=true
COMPOSE_PROFILES=ollama
OLLAMA_MODEL=gemma4:e2b   # any tag from https://ollama.com/library
```

**2. Build and start both services:**

```bash
docker compose up --build
```

`COMPOSE_PROFILES=ollama` (set in `.env`) activates the Ollama service
automatically, so no extra flags are needed on the command line.

> **Note:** The first start downloads the model weights (can be several GB).
> Watch the `ollama` container logs to track progress:
> ```bash
> docker compose logs -f ollama
> ```
> The app is available immediately at <http://localhost:8000>, but chat
> requests will fail until the model pull completes.

To switch to a different model, change `OLLAMA_MODEL` in `.env` and restart:

```bash
docker compose down && docker compose up --build
```

Previously pulled models remain cached in the `ollama_data` volume.
To free the disk space, remove the volume:

```bash
docker compose down -v
```

### Backend API

The FastAPI backend exposes two endpoints that the plugin calls automatically:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/{item_id}/stream` | SSE stream for internal manifests |
| `POST` | `/api/chat/external` | Plain JSON for external manifests |

Interactive docs are available at <http://localhost:8000/docs>.

### Building without Docker

```bash
# Build the demo SPA
npm run build:demo   # outputs to dist-demo/

# Install Python dependencies
pip install -r backend/requirements.txt

# Run the backend (serves the SPA + API)
uvicorn backend.main:app --reload
```

## Development

```bash
# Install dependencies
npm install

# Start the demo dev server (opens http://localhost:4444)
npm start

# Build the library
npm run build
```

The demo app lives in `demo/src/`. Copy `demo/src/.env.example` to `demo/src/.env` and set `VITE_API_ENDPOINT` before starting the server if you have a real backend to test against.

## Plugin structure

```
src/
├── index.js                       # Plugin entry-point; exports miradorChatPlugin[]
├── state/
│   └── action-types.js            # Mirador Redux action type constants
├── ChatCompanionWindowContainer.jsx
├── QuestionPanel.jsx
├── api.js                         # Mock question API (non-streaming)
├── api/
│   └── mockStreamingAPI.js        # Mock SSE streaming API
├── components/
│   ├── ChatComponent.jsx          # Main chat UI
│   ├── ChatCompanionWindow.jsx
│   ├── ChatIcon.jsx
│   ├── ChatInput.jsx
│   ├── ChatMessage.jsx
│   ├── ChatTopBarButton.jsx       # Top-bar toggle button
│   ├── EvidenceItem.jsx
│   ├── EvidencePanel.jsx
│   ├── ScopeSelector.jsx
│   └── StreamingMessage.jsx
└── hooks/
    ├── useCanvasNavigation.js     # Canvas navigation & highlight logic
    ├── useConversation.js         # Conversation state & SSE streaming
    └── useWebLLMEngine.js         # WebLLM in-browser engine lifecycle
```

## License

Apache-2.0
