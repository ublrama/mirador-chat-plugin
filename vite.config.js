import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

/**
 * Vite configuration for mirador-chat-plugin
 * Builds the plugin as an ES module library.
 * See: https://github.com/ProjectMirador/mirador/wiki/Creating-a-Mirador-4-plugin
 */
export default defineConfig({
  build: {
    lib: {
      entry: './src/index.js',
      fileName: (format) => (format === 'es' ? 'mirador-chat-plugin.es.js' : 'mirador-chat-plugin.umd.js'),
      formats: ['es'],
      name: 'MiradorChatPlugin',
    },
    rollupOptions: {
      // Exclude peer dependencies from the bundle
      external: (id) => {
        const peers = Object.keys(pkg.peerDependencies);
        return (
          peers.indexOf(id) > -1
          || peers.find((peer) => id.startsWith(`${peer}/`))
        );
      },
      output: {
        assetFileNames: 'mirador-chat-plugin.[ext]',
      },
    },
    sourcemap: true,
  },
  esbuild: {
    include: [/src\/.*\.jsx?$/],
    loader: 'jsx',
  },
  plugins: [react()],
  server: {
    open: '/demo/src/index.html',
    port: 4444,
  },
});
