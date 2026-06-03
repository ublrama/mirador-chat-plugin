import React from 'react';
import PropTypes from 'prop-types';
import { ChatComponent } from './ChatComponent';

/**
 * Chat Companion Window Component
 * This wraps the ChatComponent in a CompanionWindow for the Mirador sidebar
 * 
 * Note: We import CompanionWindow dynamically through props since we're in a plugin
 * and cannot directly import from Mirador's containers
 */
export function ChatCompanionWindowContent({
  id,
  windowId,
  manifestId,
  canvasId,
  canvasIndex,
  state,
  actions,
}) {
  return (
    <ChatComponent
      manifestId={manifestId}
      windowId={windowId}
      currentCanvasId={canvasId}
      canvasIndex={canvasIndex}
      state={state}
      actions={actions}
    />
  );
}

ChatCompanionWindowContent.propTypes = {
  id: PropTypes.string.isRequired,
  windowId: PropTypes.string.isRequired,
  manifestId: PropTypes.string,
  canvasId: PropTypes.string,
  canvasIndex: PropTypes.number,
  state: PropTypes.object,
  actions: PropTypes.object,
};
