import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const MessageContainer = styled(Box)(({ theme, role }) => ({
  display: 'flex',
  justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
  marginBottom: theme.spacing(2),
  gap: theme.spacing(1),
  // Critical: allow flex children to shrink so the bubble respects maxWidth
  // and long words/URLs can wrap instead of forcing the chat width to grow.
  minWidth: 0,
  width: '100%',
}));

const MessageBubble = styled(Paper)(({ theme, role }) => ({
  padding: theme.spacing(1.5, 2),
  maxWidth: '75%',
  minWidth: 0,
  backgroundColor: role === 'user'
    ? theme.palette.primary.main
    : theme.palette.background.default,
  color: role === 'user'
    ? theme.palette.primary.contrastText
    : theme.palette.text.primary,
  borderRadius: theme.spacing(2),
  // Wrap long content (including unbroken strings like URLs or hashes)
  wordWrap: 'break-word',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
}));

const IconContainer = styled(Box)(({ theme, role }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: '50%',
  backgroundColor: role === 'user' 
    ? theme.palette.primary.light 
    : theme.palette.grey[300],
  color: role === 'user' 
    ? theme.palette.primary.contrastText 
    : theme.palette.text.primary,
  flexShrink: 0,
  marginTop: theme.spacing(0.5),
}));

const Timestamp = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  marginTop: theme.spacing(0.5),
}));

/**
 * Chat message component for displaying user or assistant messages
 */
export function ChatMessage({ message }) {
  const { role, content, timestamp } = message;
  
  const formatTimestamp = (ts) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <MessageContainer role={role}>
      {role === 'assistant' && (
        <IconContainer role={role}>
          <SmartToyIcon fontSize="small" />
        </IconContainer>
      )}
      
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: role === 'user' ? 'flex-end' : 'flex-start', minWidth: 0, flex: 1, overflow: 'hidden' }}>
        <MessageBubble elevation={1} role={role}>
          <Typography variant="body1" component="div" sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {content}
          </Typography>
        </MessageBubble>
        
        {timestamp && (
          <Timestamp>
            {formatTimestamp(timestamp)}
          </Timestamp>
        )}
      </Box>

      {role === 'user' && (
        <IconContainer role={role}>
          <PersonIcon fontSize="small" />
        </IconContainer>
      )}
    </MessageContainer>
  );
}

ChatMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.oneOf(['user', 'assistant']).isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.string,
  }).isRequired,
};
