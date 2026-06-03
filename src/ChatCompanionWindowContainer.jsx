import React from 'react';
import PropTypes from 'prop-types';
import CompanionWindow from '../../mirador/src/containers/CompanionWindow.js';
import { ChatComponent } from './components/ChatComponent';

/**
 * Chat Companion Window Container
 * Wraps ChatComponent in a CompanionWindow for the Mirador sidebar
 */
export function ChatCompanionWindow({
  id,
  windowId,
  manifestId,
  state,
  actions,
}) {

  // Guard against missing actions
  if (!actions) {
    console.warn('[ChatCompanionWindow] Actions not available - plugin may not be properly registered');
  }

  console.debug('[ChatCompanionWindow] Props received', {
    id,
    windowId,
    manifestId,
    stateExists: !!state,
    actionsExists: !!actions,
    actionKeys: actions ? Object.keys(actions).slice(0, 15) : [],
  });
  return (
      <CompanionWindow
          title="AI Chat Assistant"
          windowId={windowId}
          id={id}
          style={{ width: '100%', flex: 1 }}
      >
        <ChatComponent
            manifestId={manifestId}
            windowId={windowId}
            state={state}
            actions={actions}
        />
      </CompanionWindow>

  );
}

ChatCompanionWindow.propTypes = {
  id: PropTypes.string.isRequired,
  windowId: PropTypes.string.isRequired,
  manifestId: PropTypes.string,
  state: PropTypes.object,
  actions: PropTypes.object,
};
