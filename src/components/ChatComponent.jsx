import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  Button,
  Snackbar,
  FormControlLabel,
  Switch,
  LinearProgress,
  Chip,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import MemoryIcon from '@mui/icons-material/Memory';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useConversation } from '../hooks/useConversation';
import { useCanvasNavigation } from '../hooks/useCanvasNavigation';
import { useWebLLMEngine } from '../hooks/useWebLLMEngine';
import { ChatMessage } from './ChatMessage';
import { StreamingMessage } from './StreamingMessage';
import { ChatInput } from './ChatInput';

const ChatContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  width: '100%',
  height: '100%',   // fills the sticky wrapper which has a definite pixel height
  minHeight: 0,
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  gap: 0,
  flex: 1,
}));

const ChatMainPanel = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  maxWidth: 'none',
  width: '100%',
  height: '100%',
  minHeight: 0, // Critical: allow flex child (MessageArea) to scroll instead of expanding
  overflow: 'hidden',
}));

const ChatHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  flexShrink: 0,
}));

const MessageArea = styled(Box)(({ theme }) => ({
  flex: '1 1 0',
  minHeight: 0,      // allows the area to shrink so it scrolls instead of growing
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  // Ensure any stray long text wraps inside the scroll area
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}));

const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

const WebLLMBannerBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  flexShrink: 0,
}));

/**
 * Main chat component integrating all chat features
 */
export function ChatComponent({ manifestId, windowId, state, actions }) {

  // Debug: Log props on every render
  useEffect(() => {


    console.debug('[ChatComponent] props changed', {
      manifestId,
      windowId,
      stateExists: !!state,
      actionsExist: !!actions,
      stateWindowsKeys: state?.windows ? Object.keys(state.windows) : [],
      currentStateWindow: state?.windows?.[windowId],
    });
  }, [manifestId, windowId, state, actions]);




  // Scope is fixed to the current canvas — questions are always about the
  // page the user is looking at.
  const scope = 'canvas';
  // Image context is always enabled — the AI uses the current canvas image
  // automatically whenever one is available. The user only opts in/out of
  // including manifest metadata.
  const useImageContext = true;
  const [useMetadataContext, setUseMetadataContext] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const messageAreaRef = useRef(null);
  const chatInputRef = useRef(null);

  // Custom hooks - useCanvasNavigation will read canvasIndex from state
  const canvasNav = useCanvasNavigation(state, windowId, actions);

  // WebLLM in-browser engine (optional; only active when VITE_WEBLLM_ENABLED=true)
  const webLLMEnabled = import.meta.env.VITE_WEBLLM_ENABLED === 'true';
  const webLLM = useWebLLMEngine();
  const resolvedEngine = webLLMEnabled ? (webLLM.engine || null) : null;

  // Resolve the current canvas image URL for vision-model use
  const canvasImageUrl = useImageContext && canvasNav.currentCanvas
    ? canvasNav.getCanvasThumbnail(canvasNav.currentCanvas.id)
    : null;

  const conversation = useConversation(manifestId, {
    scope,
    canvasId: canvasNav.currentCanvas?.id,
    useImageContext,
    useMetadataContext,
    engine: resolvedEngine,
    canvasImageUrl,
    modelId: webLLM.modelId,
  });

  useEffect(() => {
    console.debug('[ChatComponent] canvasNav.currentCanvas changed', {
      currentCanvas: canvasNav.currentCanvas,
      canvasId: canvasNav.currentCanvas?.id,
      canvasIndex: canvasNav.currentCanvas?.index,
      timestamp: new Date().toISOString(),
    });
  }, [canvasNav.currentCanvas]);

  // Add this debug check right after
  useEffect(() => {
    console.debug('[ChatComponent] useCanvasNavigation initialized', {
      hasActions: !!actions,
      canvasNavFunctions: {
        navigateToCanvas: !!canvasNav.navigateToCanvas,
        navigateToAnnotation: !!canvasNav.navigateToAnnotation,
      },
      currentCanvas: canvasNav.currentCanvas,
      timestamp: new Date().toISOString(),
    });
  }, [actions, canvasNav]);

// javascript
// In ChatComponent, add this after the useConversation hook call
  useEffect(() => {
    console.debug('[ChatComponent] conversation state changed', {
      messagesCount: conversation.messages.length,
      canvasId: canvasNav.currentCanvas?.id,
      canvasIndex: canvasNav.currentCanvas?.index,
      sessionId: conversation.sessionId,
      timestamp: new Date().toISOString(),
    });
  }, [conversation.messages, conversation.sessionId, canvasNav.currentCanvas?.id]);


  const {
    messages,
    streamingMessage,
    isLoading,
    error,
    sendQuestion,
    clearHistory,
    saveConversation,
    cancelRequest,
  } = conversation;

  // Return focus to input when AI finishes answering
  useEffect(() => {
    if (!isLoading && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isLoading]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messageAreaRef.current) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  const handleSendMessage = async (message) => {
    await sendQuestion(message);
  };

  const handleNewChat = () => {
    if (messages.length > 0) {
      // Save current conversation before clearing
      saveConversation();
      setSnackbarMessage('Previous conversation saved. Starting new chat...');
      setSnackbarOpen(true);
    }
    clearHistory();
  };


  return (
    <ChatContainer>
      <ChatMainPanel>
        <ChatHeader>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              AI Chat Assistant
            </Typography>
            
            <HeaderActions>
              <Tooltip title="New conversation">
                <IconButton size="small" onClick={handleNewChat}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </HeaderActions>
          </Box>


          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
            <Tooltip title="Include manifest metadata (title, description, date, etc.) as context for the AI">
              <FormControlLabel
                control={
                  <Switch
                    checked={useMetadataContext}
                    onChange={(e) => setUseMetadataContext(e.target.checked)}
                    disabled={isLoading}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DescriptionIcon fontSize="small" sx={{ color: useMetadataContext ? 'primary.main' : 'text.secondary' }} />
                    <Typography variant="body2" color={useMetadataContext ? 'primary' : 'text.secondary'}>
                      Use metadata as context
                    </Typography>
                  </Box>
                }
                slotProps={{ typography: { component: 'span' } }}
              />
            </Tooltip>
          </Box>
        </ChatHeader>

        {/* WebLLM status banner – shown only when VITE_WEBLLM_ENABLED=true */}
        {webLLMEnabled && (
          <WebLLMBannerBox>
            {webLLM.status === 'idle' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MemoryIcon fontSize="small" color="action" />
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  In-browser AI available ({webLLM.modelId})
                </Typography>
                <Button size="small" variant="outlined" onClick={webLLM.initEngine}>
                  Load model
                </Button>
              </Box>
            )}

            {webLLM.status === 'loading' && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <MemoryIcon fontSize="small" color="primary" />
                  <Typography variant="caption" color="primary" sx={{ flex: 1 }}>
                    {webLLM.progressText || 'Loading model…'} ({webLLM.progress}%)
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={webLLM.progress} />
              </Box>
            )}

            {webLLM.status === 'ready' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MemoryIcon fontSize="small" color="success" />
                <Typography variant="caption" color="success.main" sx={{ flex: 1 }}>
                  In-browser AI ready
                </Typography>
                <Chip label={webLLM.modelId} size="small" variant="outlined" />
              </Box>
            )}

            {webLLM.status === 'unsupported' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MemoryIcon fontSize="small" color="disabled" />
                <Typography variant="caption" color="text.disabled">
                  WebGPU not available – using backend
                </Typography>
              </Box>
            )}

            {webLLM.status === 'error' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="error" sx={{ flex: 1 }}>
                  Failed to load model: {webLLM.error}
                </Typography>
                <Button size="small" color="error" onClick={webLLM.initEngine}>
                  Retry
                </Button>
              </Box>
            )}
          </WebLLMBannerBox>
        )}

        <MessageArea ref={messageAreaRef}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {messages.length === 0 && !streamingMessage && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                padding: 4,
              }}
            >
              <Typography variant="h6" gutterBottom color="textSecondary">
                Welcome to AI Chat Assistant
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Ask questions about the current page to get AI-powered answers.
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Examples:
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • Describe the objects in this image?
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • Transcribe this image
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • What colours do you see?
              </Typography>
            </Box>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {streamingMessage && (
            <StreamingMessage message={streamingMessage} />
          )}
        </MessageArea>

        <Box sx={{ flexShrink: 0 }}>
          <ChatInput
            onSendMessage={handleSendMessage}
            onCancel={cancelRequest}
            disabled={false}
            isLoading={isLoading}
            inputRef={chatInputRef}
          />
        </Box>
      </ChatMainPanel>


      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </ChatContainer>
  );
}

ChatComponent.propTypes = {
  manifestId: PropTypes.string,
  windowId: PropTypes.string.isRequired,
  state: PropTypes.object,
  actions: PropTypes.object,
};