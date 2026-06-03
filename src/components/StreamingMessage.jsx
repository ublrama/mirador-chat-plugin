import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Paper, CircularProgress } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const MessageContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-start',
  marginBottom: theme.spacing(2),
  gap: theme.spacing(1),
}));

const MessageBubble = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  maxWidth: '75%',
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.primary,
  borderRadius: theme.spacing(2),
  wordWrap: 'break-word',
  whiteSpace: 'pre-wrap',
  position: 'relative',
}));

const IconContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: '50%',
  backgroundColor: theme.palette.grey[300],
  color: theme.palette.text.primary,
  flexShrink: 0,
  marginTop: theme.spacing(0.5),
}));

const StreamingText = styled('span')({
  animation: `${fadeIn} 0.3s ease-in`,
});

const Cursor = styled('span')(({ theme }) => ({
  display: 'inline-block',
  width: '2px',
  height: '1em',
  backgroundColor: theme.palette.primary.main,
  marginLeft: '2px',
  animation: 'blink 1s infinite',
  '@keyframes blink': {
    '0%, 49%': { opacity: 1 },
    '50%, 100%': { opacity: 0 },
  },
}));

const LoadingIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

/**
 * Streaming message component - displays content as it arrives
 */
export function StreamingMessage({ message }) {
  const { content } = message;
  const [isComplete, setIsComplete] = useState(false);

  // Simply display the content as it arrives, no character animation needed
  useEffect(() => {
    if (!content) {
      setIsComplete(false);
      return;
    }

    // Content is now displayed immediately as chunks arrive
    console.debug('[StreamingMessage] Content updated', {
      contentLength: content.length,
      isComplete: content.length > 0,
      timestamp: new Date().toISOString(),
    });

    setIsComplete(true);
  }, [content]);

  return (
      <MessageContainer>
        <IconContainer>
          <SmartToyIcon fontSize="small" />
        </IconContainer>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <MessageBubble elevation={1}>
            {content ? (
                <>
                  <Typography variant="body1" component="div">
                    <StreamingText>{content}</StreamingText>
                    {!isComplete && <Cursor />}
                  </Typography>
                </>
            ) : (
                <LoadingIndicator>
                  <CircularProgress size={16} />
                  <Typography variant="body2">Thinking...</Typography>
                </LoadingIndicator>
            )}
          </MessageBubble>
        </Box>
      </MessageContainer>
  );
}

StreamingMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string,
    role: PropTypes.string,
    content: PropTypes.string,
    evidence: PropTypes.array,
  }),
};
