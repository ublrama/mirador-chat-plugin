import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration for building the demo app as a standalone SPA.
 * This is used by the Docker build to produce static files served by FastAPI.
 *
 * Usage:
 *   vite build --config vite.config.demo.js
 */
export default defineConfig({
  root: 'demo/src',
  build: {
    outDir: '../../dist-demo',
    emptyOutDir: true,
  },
  esbuild: {
    include: [/.*\.jsx?$/],
    loader: 'jsx',
  },
  plugins: [react()],
  server: {
    open: true,
    port: 4444,
  },
});
