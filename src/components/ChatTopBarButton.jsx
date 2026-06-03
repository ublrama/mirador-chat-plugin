import React from 'react';
import PropTypes from 'prop-types';
import { IconButton, Tooltip } from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';

/**
 * Chat button component for the top bar (right side)
 * Opens/closes a companion window on the right side
 */
export function ChatTopBarButton({ addCompanionWindow, removeCompanionWindow, existingWindowId }) {
  const handleClick = () => {
    if (existingWindowId) {
      // Close existing window
      removeCompanionWindow(existingWindowId);
    } else {
      // Add new companion window with position: 'right'
      addCompanionWindow('chat');
    }
  };

  return (
    <Tooltip title="AI Chat Assistant">
      <IconButton
        aria-label="Open AI Chat Assistant"
        onClick={handleClick}
        size="small"
        color={existingWindowId ? 'primary' : 'default'}
      >
        <ChatBubbleOutlineIcon />
      </IconButton>
    </Tooltip>
  );
}

ChatTopBarButton.propTypes = {
  addCompanionWindow: PropTypes.func.isRequired,
  removeCompanionWindow: PropTypes.func.isRequired,
  existingWindowId: PropTypes.string,
};

ChatTopBarButton.displayName = 'ChatTopBarButton';
