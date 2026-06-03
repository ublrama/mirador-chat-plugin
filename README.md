# mirador-chat-plugin

A [Mirador 4](https://github.com/ProjectMirador/mirador) plugin that adds an AI chat assistant companion window to every viewer window. Users can ask questions about the loaded IIIF manifest and receive streaming answers with annotation-based evidence links.

## Features

- **Chat button** in the window top-bar that toggles a right-side companion window
- **Streaming responses** via Server-Sent Events (SSE) from your own backend
- **Evidence panel** linking AI answers back to canvas annotations
- **Scope selector** – search across the entire manifest or restrict to the current canvas
- **Image & metadata context** toggles that enrich the prompt sent to the LLM
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
    └── useConversation.js         # Conversation state & SSE streaming
```

## License

Apache-2.0
