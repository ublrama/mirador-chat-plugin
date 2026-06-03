import React from 'react';
import PropTypes from 'prop-types';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';

/**
 * Chat icon component for the sidebar button
 * This is a plugin component for WindowSideBarButtons
 */
export function ChatIcon({ value }) {
  // The value prop is used by the WindowSideBarButtons TabButton wrapper
  // We just need to return the icon
  return <ChatBubbleOutlineIcon />;
}

ChatIcon.propTypes = {
  value: PropTypes.string,
};

// Add the value as a static property for the plugin system
// This is used by WindowSideBarButtons to identify the companion window type
ChatIcon.value = 'chat';

// Add a display name for debugging
ChatIcon.displayName = 'ChatIcon';
