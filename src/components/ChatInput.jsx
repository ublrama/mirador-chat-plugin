import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';

const InputContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
}));

/**
 * Chat input component with send button
 */
export function ChatInput({ onSendMessage, disabled = false, isLoading = false, onCancel, inputRef }) {
  const [input, setInput] = useState('');
  const internalRef = useRef(null);
  const resolvedRef = inputRef || internalRef;

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <InputContainer>
      <TextField
        fullWidth
        multiline
        maxRows={4}
        variant="outlined"
        placeholder="Ask a question about this manifest..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled || isLoading}
        size="small"
        inputRef={resolvedRef}
      />
      
      {isLoading ? (
        <Tooltip title="Stop generating">
          <IconButton
            color="error"
            onClick={handleCancel}
            disabled={disabled}
          >
            <StopIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Send message">
          <span>
            <IconButton
              color="primary"
              onClick={handleSubmit}
              disabled={disabled || !input.trim()}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </InputContainer>
  );
}

ChatInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
};
