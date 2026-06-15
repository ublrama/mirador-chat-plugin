import Mirador from 'mirador';
import miradorChatPlugin from '../../src';

/**
 * Demo configuration for the mirador-chat-plugin.
 *
 * Set VITE_API_ENDPOINT in a .env file to point at your backend.
 * When no backend is available the plugin automatically falls back to the
 * built-in mock streaming API so the UI is always usable.
 *
 * Runtime params can be injected via window.__MIRADOR_PARAMS__:
 *   { manifest, manifestId, canvasId, canvasID, collection }
 */

// ── Plugin normalisation ─────────────────────────────────────────────────────
function normalizePlugins(...items) {
  return items.flatMap(p => Array.isArray(p) ? p : (p ? [p] : []));
}

const PLUGINS = normalizePlugins(miradorChatPlugin);

// ── URL validation ────────────────────────────────────────────────────────────
function isValidUrl(v) {
  if (!v || typeof v !== 'string') return false;
  try {
    new URL(v);
    return true;
  } catch (e) {
    return false;
  }
}

// ── Read and normalise runtime params ────────────────────────────────────────
// Priority (highest → lowest):
//   1. window.__MIRADOR_PARAMS__  – set explicitly by the server / embedder
//   2. URL query string           – e.g. ?manifest=https://…&canvasId=https://…
const urlSearchParams =
  typeof window !== 'undefined'
    ? Object.fromEntries(new URLSearchParams(window.location.search))
    : {};

const rawParams = {
  ...urlSearchParams,
  ...(typeof window !== 'undefined' && window.__MIRADOR_PARAMS__
    ? window.__MIRADOR_PARAMS__
    : {}),
};

let manifest =
  (typeof rawParams.manifest === 'string'
    ? rawParams.manifest
    : typeof rawParams.manifestId === 'string'
      ? rawParams.manifestId
      : '') || '';

let canvasId = rawParams.canvasId || rawParams.canvasID || '';
const collection = rawParams.collection || '';

// Validate
if (!isValidUrl(manifest)) manifest = '';
if (canvasId && !isValidUrl(canvasId)) canvasId = '';

// Exclusivity rules
if (collection) {
  manifest = '';
  canvasId = '';
}
if (!manifest) {
  canvasId = '';
}

// ── Shared theme helper ───────────────────────────────────────────────────────
const devTransitions =
  typeof window !== 'undefined' && window.location.port === '4488'
    ? { create: () => 'none' }
    : {};

// ── Viewer factories ──────────────────────────────────────────────────────────
export function loadDefaultMirador() {
  Mirador.viewer(
    {
      id: 'demo',
      windows: [
        {

          loadedManifest: 'https://digitalcollections.universiteitleiden.nl/iiif_manifest/item:3479124/manifest',
        },
      ],
      catalog: [
        {
          manifestId: 'https://digitalcollections.universiteitleiden.nl/iiif_manifest/collection:western_mediev_manuscripts/manifest',
          provider: 'Leiden University Libraries'
        },
        {
          manifestId: 'https://digitalcollections.universiteitleiden.nl/iiif_manifest/collection:frankscholten/manifest',
          provider: 'Leiden University Libraries'
        },
          {
              manifestId: 'https://media.nga.gov/public/manifests/nga_highlights.json'
          },
          {
              manifestId: 'https://iiif.biblissima.fr/chateauroux/B360446201_MS0005/manifest.json'
          }
          ,
          {
              manifestId: ' https://iiif.wellcomecollection.org/presentation/v2/b18035723'
          }



      ],
      thumbnailNavigation: {
        defaultPosition: 'far-bottom',
        displaySettings: true,
        showThumbnailLabels: true,
      },
      theme: { transitions: devTransitions },
      window: {
        allowClose: true,
        sideBarPanel: 'info',
        sideBarOpen: true,
        panels: {
          info: true,
          attribution: false,
          canvas: true,
          annotations: true,
          search: true,
          layers: true,
        },
      },
    },
    PLUGINS,
  );
}

export function loadManifestMirador(uri, canvasIdArg) {
  Mirador.viewer(
    {
      id: 'demo',
      windows: [
        {
          imageToolsEnabled: true,
          imageToolsOpen: true,
          manifestId: uri,
          canvasId: canvasIdArg || undefined,
        },
      ],
      thumbnailNavigation: {
        defaultPosition: 'far-bottom',
        displaySettings: true,
        showThumbnailLabels: true,
      },
      theme: { transitions: devTransitions },
      window: {
        allowClose: true,
        sideBarPanel: 'info',
        sideBarOpen: true,
        panels: {
          info: true,
          attribution: false,
          canvas: true,
          annotations: true,
          search: true,
          layers: true,
        },
      },
      workspace: {
        showZoomControls: true,
        allowNewWindows: true,
        type: 'mosaic',
      },
      workspaceControlPanel: {
        enabled: true,
      },
    },
    PLUGINS,
  );
}

export function loadCollectionMirador(uri) {
  Mirador.viewer(
    {
      id: 'demo',
      windows: [{ manifestId: uri }],
      catalog: [{ manifestId: uri }],
    },
    PLUGINS,
  );
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
if (manifest) {
  loadManifestMirador(manifest, canvasId);
} else if (collection) {
  loadCollectionMirador(collection);
} else {
  loadDefaultMirador();
}
