import Mirador from 'mirador';
import miradorChatPlugin from '../../src';

/**
 * Demo configuration for the mirador-chat-plugin.
 *
 * Set VITE_API_ENDPOINT in a .env file to point at your backend.
 * When no backend is available the plugin automatically falls back to the
 * built-in mock streaming API so the UI is always usable.
 */
const config = {
  id: 'demo',
  windows: [
    {
      loadedManifest: 'https://purl.stanford.edu/bb020ty1503/iiif/manifest',
    },
  ],
};

Mirador.viewer(config, [...miradorChatPlugin]);
