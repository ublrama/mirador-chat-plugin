import React from 'react';
import PropTypes from 'prop-types';
import { ChatComponent } from './components/ChatComponent';

/**
 * Chat Companion Window Container
 * Renders ChatComponent inside Mirador's companion window.
 * The CompanionWindow wrapper is provided automatically by Mirador's plugin
 * system when registering a plugin with `companionWindowKey`.
 */
export function ChatCompanionWindow({
  id,
  windowId,
  manifestId,
  state,
  actions,
}) {
  return (
    <ChatComponent
      manifestId={manifestId}
      windowId={windowId}
      state={state}
      actions={actions}
    />
  );
}

ChatCompanionWindow.propTypes = {
  id: PropTypes.string.isRequired,
  windowId: PropTypes.string.isRequired,
  manifestId: PropTypes.string,
  state: PropTypes.object,
  actions: PropTypes.object,
};

