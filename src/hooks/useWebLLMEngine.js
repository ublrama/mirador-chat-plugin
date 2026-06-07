import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Default vision-capable model.  Users can override this via the
 * VITE_WEBLLM_MODEL environment variable (set at build/dev time).
 */
const DEFAULT_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

/**
 * Hook that manages a WebLLM engine lifecycle.
 *
 * The engine runs inference entirely in the browser via WebGPU – no backend
 * server required.  When WebGPU is not available the hook returns early with
 * status "unsupported" and a null engine so callers can fall back gracefully.
 *
 * @returns {{
 *   engine: object|null,
 *   status: 'idle'|'loading'|'ready'|'error'|'unsupported',
 *   progress: number,       // 0-100
 *   progressText: string,
 *   error: string|null,
 *   modelId: string,
 *   initEngine: () => void  // call to start loading
 * }}
 */
export function useWebLLMEngine() {
  const modelId =
    import.meta.env.VITE_WEBLLM_MODEL || DEFAULT_MODEL;

  const [engine, setEngine] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState(null);

  // Keep a stable ref to avoid double-init from StrictMode double-invoke
  const initCalledRef = useRef(false);
  const engineRef = useRef(null);

  const initEngine = useCallback(async () => {
    // Prevent duplicate initialisation
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    // Graceful degradation: WebGPU not available
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      setStatus('unsupported');
      return;
    }

    setStatus('loading');
    setProgress(0);
    setError(null);

    try {
      // Dynamic import keeps the heavy WebLLM bundle out of the initial chunk
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      const initProgressCallback = ({ progress: p, text }) => {
        // p is 0-1; normalise to 0-100
        const pct = Math.round((p || 0) * 100);
        setProgress(pct);
        setProgressText(text || '');
      };

      const newEngine = await CreateMLCEngine(modelId, {
        initProgressCallback,
      });

      engineRef.current = newEngine;
      setEngine(newEngine);
      setProgress(100);
      setStatus('ready');
    } catch (err) {
      console.error('[useWebLLMEngine] Failed to initialise engine:', err);
      setError(err.message || 'Failed to load WebLLM engine');
      setStatus('error');
      initCalledRef.current = false; // allow retry
    }
  }, [modelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        try {
          engineRef.current.unload?.();
        } catch (_) {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  return { engine, status, progress, progressText, error, modelId, initEngine };
}
