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
