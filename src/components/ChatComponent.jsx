import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useConversation } from '../hooks/useConversation';
import { useCanvasNavigation } from '../hooks/useCanvasNavigation';
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

  const scope = 'canvas';
  const useImageContext = true;
  const [useMetadataContext, setUseMetadataContext] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const messageAreaRef = useRef(null);
  const chatInputRef = useRef(null);

  // ── Model selector ────────────────────────────────────────────────────────
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    const baseEndpoint = import.meta.env.VITE_API_ENDPOINT || '/api/chat';
    // Derive the /api/models URL from the configured endpoint base
    const modelsUrl = baseEndpoint.replace(/\/chat$/, '/models');
    fetch(modelsUrl)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        setAvailableModels(data.models || []);
        setSelectedModel(data.default || (data.models?.[0]?.id ?? null));
      })
      .catch(() => {
        // Backend not reachable — selector stays hidden
        setAvailableModels([]);
      })
      .finally(() => setModelsLoading(false));
  }, []);

  const canvasNav = useCanvasNavigation(state, windowId, actions);

  const canvasImageUrl = useImageContext && canvasNav.currentCanvas
    ? canvasNav.getCanvasThumbnail(canvasNav.currentCanvas.id)
    : null;

  const conversation = useConversation(manifestId, {
    scope,
    canvasId: canvasNav.currentCanvas?.id,
    useImageContext,
    useMetadataContext,
    canvasImageUrl,
    model: selectedModel,
  });

  useEffect(() => {
    console.debug('[ChatComponent] canvasNav.currentCanvas changed', {
      currentCanvas: canvasNav.currentCanvas,
      canvasId: canvasNav.currentCanvas?.id,
      canvasIndex: canvasNav.currentCanvas?.index,
      timestamp: new Date().toISOString(),
    });
  }, [canvasNav.currentCanvas]);

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

  useEffect(() => {
    if (!isLoading && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isLoading]);

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

          {/* Model selector — only shown when the backend reports ≥1 model */}
          {!modelsLoading && availableModels.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <FormControl size="small" fullWidth disabled={isLoading}>
                <InputLabel id="model-select-label" sx={{ fontSize: '0.75rem' }}>Model</InputLabel>
                <Select
                  labelId="model-select-label"
                  value={selectedModel || ''}
                  label="Model"
                  onChange={(e) => setSelectedModel(e.target.value)}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {availableModels.map((m) => (
                    <MenuItem key={m.id} value={m.id} sx={{ fontSize: '0.75rem' }}>
                      <Box>
                        <Typography variant="body2" component="span">{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                          ({m.provider})
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          {modelsLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <CircularProgress size={12} />
              <Typography variant="caption" color="text.secondary">Loading models…</Typography>
            </Box>
          )}
        </ChatHeader>

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
                • Transcribe this image for me
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • Can you tell me when this image was taken?
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • Translate the writing in this image
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