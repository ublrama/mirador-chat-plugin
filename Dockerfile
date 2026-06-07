# ── Stage 1: build the Vite SPA ──────────────────────────────────────────────
FROM node:20-alpine AS node-builder

WORKDIR /app

# Install dependencies (separate layer for better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the demo SPA
COPY . .

# VITE_API_ENDPOINT tells the frontend where to call the backend.
# /api/chat is served by FastAPI on the same origin, so no CORS needed.
ARG VITE_API_ENDPOINT=/api/chat
ENV VITE_API_ENDPOINT=${VITE_API_ENDPOINT}

RUN npm run build:demo


# ── Stage 2: Python / FastAPI runtime ─────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy the built frontend from the previous stage
COPY --from=node-builder /app/dist-demo ./dist-demo

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
