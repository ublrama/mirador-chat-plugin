import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for navigating and interacting with Mirador canvases
 * @param {Object} state - Mirador state object
 * @param {string} windowId - Current window ID
 * @param {Object} actions - Mirador actions (if available)
 * @returns {Object} Navigation methods and current canvas info
 */
export function useCanvasNavigation(state, windowId, actions = null) {
  const [currentCanvas, setCurrentCanvas] = useState(null);
  const [highlightedRegions, setHighlightedRegions] = useState([]);

  // Extract current canvas from Mirador state
  useEffect(() => {

    console.debug('[useCanvasNavigation] effect running', {
      windowId,
      hasState: !!state,
      hasManifests: !!state?.manifests,
    });

    if (!state || !windowId) {
      console.debug('[useCanvasNavigation] no state or windowId', { state: !!state, windowId });
      setCurrentCanvas(null);
      return;
    }

    const win = state.windows?.[windowId];
    const manifestId = win?.manifestId;

    console.debug('[useCanvasNavigation] window change', {
      windowId,
      win,
      manifestId,
    });

    // Prefer numeric canvasIndex if present
    let currentCanvasIndex = typeof win?.canvasIndex === 'number' ? win.canvasIndex : undefined;

    // Try several possible id-like fields Mirador might use
    const canvasIdFromWindow = win?.canvasId || win?.currentCanvas || win?.canvas || win?.currentCanvasId || win?.selectedCanvasId;

    if (manifestId && state.manifests?.[manifestId]) {
      const manifest = state.manifests[manifestId];
      const canvases = manifest.json?.sequences?.[0]?.canvases || manifest.json?.items || [];

      if (currentCanvasIndex === undefined && canvasIdFromWindow) {
        const idx = canvases.findIndex(c => (c.id || c['@id']) === canvasIdFromWindow);
        if (idx !== -1) currentCanvasIndex = idx;
      }

      // Final fallback to 0 only if nothing else found
      if (currentCanvasIndex === undefined) currentCanvasIndex = 0;

      const canvas = canvases[currentCanvasIndex];

      console.debug('[useCanvasNavigation] resolved canvas', {
        currentCanvasIndex,
        canvasIdFromWindow,
        canvasId: canvas ? (canvas.id || canvas['@id']) : null,
      });

      if (canvas) {
        const newCurrent = {
          id: canvas.id || canvas['@id'],
          index: currentCanvasIndex,
          label: canvas.label,
        };

        // Only update if changed to avoid excessive re-renders
        if (!currentCanvas || currentCanvas.id !== newCurrent.id || currentCanvas.index !== newCurrent.index) {
          console.debug('[useCanvasNavigation] setting currentCanvas', newCurrent);
          setCurrentCanvas(newCurrent);
        } else {
          console.debug('[useCanvasNavigation] currentCanvas unchanged', newCurrent);
        }
      } else {
        console.debug('[useCanvasNavigation] no canvas found at index', currentCanvasIndex);
        setCurrentCanvas(null);
      }
    } else {
      console.debug('[useCanvasNavigation] manifest not available', { manifestId });
      setCurrentCanvas(null);
    }

    console.debug('[useCanvasNavigation] effect completed', {
      currentCanvasIndex,
      currentCanvas,
      timestamp: new Date().toISOString(),
    });

  }, [
    windowId,
    state.manifests,
    state.windows?.[windowId]?.canvasIndex,
    state.windows?.[windowId]?.canvasId,
    state.windows?.[windowId]?.currentCanvas,
    state.windows?.[windowId],
  ]);


  // Rest of the hook remains the same...
  const navigateToCanvas = useCallback((canvasIdOrIndex) => {
    console.debug('[useCanvasNavigation] navigateToCanvas called', {
      windowId,
      canvasIdOrIndex,
      actionsAvailable: !!actions,
      actionKeys: actions ? Object.keys(actions).slice(0, 10) : [],
    });
    console.debug('[useCanvasNavigation] navigateToCanvas called', { windowId, canvasIdOrIndex });
    if (!windowId) {
      console.warn('Cannot navigate: windowId is not available');
      return;
    }
    if (!actions) {
      console.warn('Cannot navigate: Mirador actions are not available');
      return;
    }

    // Check what action methods exist
    console.debug('[useCanvasNavigation] Available actions:', {
      hasSetCanvas: !!actions.setCanvas,
      hasUpdateWindow: !!actions.updateWindow,
      hasSetCanvasIndex: !!actions.setCanvasIndex,
      allActionKeys: Object.keys(actions),
    });

    if (actions.setCanvas) {
      if (typeof canvasIdOrIndex === 'number') {
        console.debug('[useCanvasNavigation] setCanvas by index', { windowId, index: canvasIdOrIndex });
        actions.setCanvas(windowId, canvasIdOrIndex);
      } else {
        const win = state.windows?.[windowId];
        const manifestId = win?.manifestId;

        if (manifestId && state.manifests?.[manifestId]) {
          const manifest = state.manifests[manifestId];
          const canvases = manifest.json?.sequences?.[0]?.canvases ||
              manifest.json?.items || [];

          const index = canvases.findIndex(c =>
              (c.id || c['@id']) === canvasIdOrIndex
          );

          console.debug('[useCanvasNavigation] resolved index for id', { canvasIdOrIndex, index });

          if (index !== -1) {
            actions.setCanvas(windowId, index);
          } else {
            console.warn('[useCanvasNavigation] canvas id not found in manifest', { canvasIdOrIndex });
          }

          if (index !== -1) {
            actions.setCanvas(index);
          }
        } else {
          console.warn('[useCanvasNavigation] manifest missing for window while navigating', { manifestId });
        }
      }
    } else if (actions.updateWindow) {
      console.debug('[useCanvasNavigation] Using updateWindow action');
      // Try updateWindow instead
      if (typeof canvasIdOrIndex === 'number') {
        actions.updateWindow(windowId, { canvasIndex: canvasIdOrIndex });
      } else {
        // resolve to index then call updateWindow
      }
    } else {
      console.warn('[useCanvasNavigation] No canvas navigation action found', Object.keys(actions));
    }
  }, [windowId, actions, state]);


  const highlightRegion = useCallback((annotation) => {
    if (!annotation) return;

    const regionId = annotation.id || `region-${Date.now()}`;

    setHighlightedRegions(prev => {
      if (prev.find(r => r.id === regionId)) {
        return prev;
      }
      return [...prev, {
        id: regionId,
        annotation,
        timestamp: Date.now(),
      }];
    });

    const target = annotation.target || annotation.on;
    if (typeof target === 'string' && target.includes('#xywh=')) {
      const match = target.match(/#xywh=([0-9,]+)/);
      if (match) {
        const [x, y, w, h] = match[1].split(',').map(Number);

        if (actions?.addOverlay) {
          actions.addOverlay(windowId, {
            id: regionId,
            x, y, w, h,
            className: 'evidence-highlight',
          });
        }
      }
    }

    setTimeout(() => {
      clearHighlight(regionId);
    }, 5000);
  }, [windowId, actions]);


  const clearHighlight = useCallback((regionId = null) => {
    if (regionId) {
      setHighlightedRegions(prev => prev.filter(r => r.id !== regionId));

      if (actions?.removeOverlay) {
        actions.removeOverlay(windowId, regionId);
      }
    } else {
      setHighlightedRegions([]);

      if (actions?.clearOverlays) {
        actions.clearOverlays(windowId);
      }
    }
  }, [windowId, actions]);


  const navigateToAnnotation = useCallback((annotation) => {
    if (!annotation) return;

    const target = annotation.target || annotation.on;
    let canvasId = null;

    if (typeof target === 'string') {
      const hashIndex = target.indexOf('#');
      canvasId = hashIndex !== -1 ? target.substring(0, hashIndex) : target;
    } else if (target?.source) {
      canvasId = target.source;
    }

    console.debug('[useCanvasNavigation] navigateToAnnotation', { annotation, canvasId, currentCanvas });

    if (canvasId && canvasId !== currentCanvas?.id) {
      navigateToCanvas(canvasId);

      setTimeout(() => {
        highlightRegion(annotation);
      }, 500);
    } else {
      highlightRegion(annotation);
    }
  }, [currentCanvas, navigateToCanvas, highlightRegion]);


  const getCanvasThumbnail = useCallback((canvasId) => {
    if (!state?.manifests) return null;

    for (const manifestId in state.manifests) {
      const manifest = state.manifests[manifestId];
      const canvases = manifest.json?.sequences?.[0]?.canvases ||
          manifest.json?.items || [];

      const canvas = canvases.find(c =>
          (c.id || c['@id']) === canvasId
      );

      if (canvas) {
        if (canvas.thumbnail) {
          return typeof canvas.thumbnail === 'string'
              ? canvas.thumbnail
              : canvas.thumbnail['@id'] || canvas.thumbnail.id;
        }

        const images = canvas.images || canvas.items;
        if (images && images[0]) {
          const resource = images[0].resource || images[0].body;
          if (resource) {
            return resource['@id'] || resource.id;
          }
        }
      }
    }

    return null;
  }, [state]);

  return {
    currentCanvas,
    navigateToCanvas,
    highlightRegion,
    clearHighlight,
    navigateToAnnotation,
    highlightedRegions,
    getCanvasThumbnail,
  };
}
