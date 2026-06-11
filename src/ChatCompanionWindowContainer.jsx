import React, { useRef, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ChatComponent } from './components/ChatComponent';

const MIN_WIDTH = 250;
const MAX_WIDTH = 750;
const DEFAULT_WIDTH = 320;

/**
 * Chat Companion Window Container
 *
 * - Height fills the Mirador window tile (same as the sidebar) and is kept
 *   in sync via a ResizeObserver on the tile element, which only fires on
 *   genuine Mirador-window resizes — never on chat-content growth.
 * - Width is managed locally: measured once from the companion container
 *   on mount, then freely adjustable by dragging the left-edge handle.
 * - Both dimensions are pinned on `.mirador-companion-windows` and
 *   `.mirador-companion-area-right` so chat content can never inflate them.
 * - A 6 px drag handle on the left edge lets the user resize the panel width.
 */
export function ChatCompanionWindow({ id, windowId, manifestId, state, actions }) {
  const wrapperRef = useRef(null);
  const companionElsRef = useRef([]);
  const savedStylesRef = useRef([]);

  // Height and width are both managed as local state so they can be set
  // from DOM measurements (not just from Redux state).
  const [panelHeight, setPanelHeight] = useState(0);
  const panelHeightRef = useRef(0);
  panelHeightRef.current = panelHeight;

  // ── Width — local state, initialised from companion container ─────────────
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const panelWidthRef = useRef(DEFAULT_WIDTH);
  panelWidthRef.current = panelWidth;

  // ── Collect companion containers + measure dimensions on mount ────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Walk up to find companion containers
    const targets = [];
    let p = el.parentElement;
    while (p && p !== document.body) {
      if (
        p.classList.contains('mirador-companion-windows') ||
        p.classList.contains('mirador-companion-area-right')
      ) {
        targets.push(p);
      }
      p = p.parentElement;
    }
    companionElsRef.current = targets;

    // Save originals for cleanup
    savedStylesRef.current = targets.map((t) => ({
      el: t,
      overflow: t.style.overflow,
      height: t.style.height,
      maxHeight: t.style.maxHeight,
      width: t.style.width,
      minWidth: t.style.minWidth,
      maxWidth: t.style.maxWidth,
    }));

    // ── Height: use the Mirador window tile height ────────────────────────
    // The parent of `.mirador-companion-area-right` is the flex row that
    // holds both the canvas area and companion panel side by side.
    // Its height equals the Mirador window tile height — the same space the
    // sidebar fills.  We observe this element (NOT the companion containers)
    // so only genuine Mirador-window resizes update our height.
    const companionAreaRight = targets.find((t) =>
      t.classList.contains('mirador-companion-area-right'),
    );
    const windowTile = companionAreaRight?.parentElement ?? null;

    const applyHeight = (h) => {
      if (!h || h <= 0) return;
      setPanelHeight(h);
      panelHeightRef.current = h;
      companionElsRef.current.forEach((t) => {
        t.style.overflow = 'hidden';
        t.style.height = `${h}px`;
        t.style.maxHeight = `${h}px`;
      });
    };

    applyHeight(windowTile?.clientHeight ?? window.innerHeight);

    // ResizeObserver on the window tile is safe: its size only changes
    // when the user resizes the Mirador mosaic pane, not from chat content.
    let ro = null;
    if (windowTile) {
      ro = new ResizeObserver(() => applyHeight(windowTile.clientHeight));
      ro.observe(windowTile);
    }

    // ── Width: measure from companion container ───────────────────────────
    const initW = targets[0]?.clientWidth;
    if (initW && initW > 0) {
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, initW));
      setPanelWidth(clamped);
      panelWidthRef.current = clamped;
    }

    return () => {
      ro?.disconnect();
      savedStylesRef.current.forEach(({ el: t, overflow, height, maxHeight, width, minWidth, maxWidth }) => {
        t.style.overflow = overflow;
        t.style.height = height;
        t.style.maxHeight = maxHeight;
        t.style.width = width;
        t.style.minWidth = minWidth;
        t.style.maxWidth = maxWidth;
      });
    };
  }, []);

  // ── Pin companion containers on every width change ────────────────────────
  // (height pinning is already done inside applyHeight above)
  useEffect(() => {
    companionElsRef.current.forEach((t) => {
      t.style.width = `${panelWidth}px`;
      t.style.minWidth = `${panelWidth}px`;
      t.style.maxWidth = `${panelWidth}px`;
    });
  }, [panelWidth]);

  // ── Drag-to-resize ────────────────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = panelWidthRef.current;

    const onMove = (moveEvt) => {
      // Panel is on the right — dragging left (startX > moveEvt.clientX) widens it
      const delta = startX - moveEvt.clientX;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
      setPanelWidth(next);
      panelWidthRef.current = next;
      // Apply immediately without waiting for React re-render
      companionElsRef.current.forEach((t) => {
        t.style.width = `${next}px`;
        t.style.minWidth = `${next}px`;
        t.style.maxWidth = `${next}px`;
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        height: panelHeight > 0 ? `${panelHeight}px` : '100%',
        maxHeight: panelHeight > 0 ? `${panelHeight}px` : '100%',
        // Fill the (now-constrained) companion container width
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Left-edge drag handle ── */}
      <div
        onMouseDown={handleResizeMouseDown}
        role="separator"
        aria-label="Resize chat panel"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 20,
          backgroundColor: 'transparent',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.12)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      />

      {/* Push content 6 px right so it never sits under the drag handle */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingLeft: 6, display: 'flex', flexDirection: 'column' }}>
        <ChatComponent
          manifestId={manifestId}
          windowId={windowId}
          state={state}
          actions={actions}
        />
      </div>
    </div>
  );
}

ChatCompanionWindow.propTypes = {
  id: PropTypes.string.isRequired,
  windowId: PropTypes.string.isRequired,
  manifestId: PropTypes.string,
  state: PropTypes.object,
  actions: PropTypes.object,
};
