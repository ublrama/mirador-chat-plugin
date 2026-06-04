import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Button,
  Snackbar,
  Badge,
  FormControlLabel,
  Switch,
  LinearProgress,
  Chip,
} from '@mui/material';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import DescriptionIcon from '@mui/icons-material/Description';
import MemoryIcon from '@mui/icons-material/Memory';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { useConversation } from '../hooks/useConversation';
import { useCanvasNavigation } from '../hooks/useCanvasNavigation';
import { useWebLLMEngine } from '../hooks/useWebLLMEngine';
import { ScopeSelector } from './ScopeSelector';
import { ChatMessage } from './ChatMessage';
import { StreamingMessage } from './StreamingMessage';
import { ChatInput } from './ChatInput';
import { EvidencePanel } from './EvidencePanel';

const ChatContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  height: '100%',
  maxHeight: 'none',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  boxShadow: theme.shadows[3],
  gap: 0,
  width: '100%',
  flex: 1, // Add this to make container grow
}));

const ChatMainPanel = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 400,
  maxWidth: 'none',
  width: '100%',
  overflow: 'hidden',
}));

const ChatHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}));

const MessageArea = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden', // Prevent horizontal scroll
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  wordWrap: 'break-word', // Wrap long text
}));

const EvidenceSidebar = styled(Box)(({ theme, isOpen }) => ({
  width: isOpen ? 350 : 0,
  borderLeft: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  transition: theme.transitions.create(['width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.standard,
  }),
  overflow: 'hidden',
  flexShrink: 0, // Prevent shrinking
  [theme.breakpoints.down('md')]: {
    width: isOpen ? 300 : 0,
  },
}));

const EvidenceSidebarCollapsed = styled(Box)(({ theme }) => ({
  width: 0,
  overflow: 'hidden',
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
}));

const EvidenceToggleButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRight: 'none',
  borderTopRightRadius: 0,
  borderBottomRightRadius: 0,
  padding: theme.spacing(1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  zIndex: 1,
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




  const [scope, setScope] = useState('manifest');
  const [useImageContext, setUseImageContext] = useState(false);
  const [useMetadataContext, setUseMetadataContext] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [evidencePanelOpen, setEvidencePanelOpen] = useState(false);
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
    sessionId,
    sendQuestion,
    clearHistory,
    saveConversation,
    cancelRequest,
  } = conversation;

  // Log canvas selection when scope is 'canvas' and canvas info changes
  useEffect(() => {
    if (scope === 'canvas' && canvasNav.currentCanvas) {
      console.log('[Chat Plugin] Canvas selected in scope:', {
        canvasId: canvasNav.currentCanvas.id,
        canvasIndex: canvasNav.currentCanvas.index,
        canvasLabel: canvasNav.currentCanvas.label,
        scope: scope,
      });
    }
  }, [scope, canvasNav.currentCanvas]);

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

  const handleNavigateToEvidence = (evidence) => {
    if (evidence.annotation) {
      canvasNav.navigateToAnnotation(evidence.annotation);
    } else if (evidence.canvas_id) {
      canvasNav.navigateToCanvas(evidence.canvas_id);
    }
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

  const handleSaveConversation = () => {
    saveConversation();
    setSnackbarMessage('Conversation saved successfully');
    setSnackbarOpen(true);
  };

  const handleToggleEvidencePanel = () => {
    setEvidencePanelOpen(!evidencePanelOpen);
  };

  // Get all evidence from messages
  const allEvidence = messages
    .filter(m => m.role === 'assistant' && m.evidence)
    .flatMap(m => m.evidence || []);

  // Add streaming message evidence if available
  if (streamingMessage?.evidence) {
    allEvidence.push(...streamingMessage.evidence);
  }

  return (
    <ChatContainer>
      <ChatMainPanel>
        <ChatHeader>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              AI Chat Assistant
            </Typography>
            
            <HeaderActions>
              <Tooltip title="Save conversation">
                <IconButton size="small" onClick={handleSaveConversation}>
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="New conversation">
                <IconButton size="small" onClick={handleNewChat}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </HeaderActions>
          </Box>

          <ScopeSelector
            scope={scope}
            onScopeChange={setScope}
            currentCanvas={canvasNav.currentCanvas}
            disabled={isLoading}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Tooltip title={
              !canvasNav.currentCanvas
                ? 'Navigate to a canvas page first to enable image context'
                : 'Send the current canvas image to the AI as additional context'
            }>
              <span>
              <FormControlLabel
                control={
                  <Switch
                    checked={useImageContext}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setUseImageContext(enabled);
                      if (enabled) setScope('canvas');
                    }}
                    disabled={isLoading || !canvasNav.currentCanvas}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ImageSearchIcon fontSize="small" sx={{ color: useImageContext ? 'primary.main' : 'text.secondary' }} />
                    <Typography variant="body2" color={useImageContext ? 'primary' : 'text.secondary'}>
                      Use image as context
                    </Typography>
                  </Box>
                }
                slotProps={{ typography: { component: 'span' } }}
              />
              </span>
            </Tooltip>
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
                Ask questions about the manifest to get AI-powered answers with evidence.
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Examples:
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • What is this document about?
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • Summarize the main themes
              </Typography>
              <Typography variant="caption" color="textSecondary">
                • Who is mentioned in this page?
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

        <ChatInput
          onSendMessage={handleSendMessage}
          onCancel={cancelRequest}
          disabled={false}
          isLoading={isLoading}
          inputRef={chatInputRef}
        />
      </ChatMainPanel>

      {/* Evidence Panel Toggle Button (shown when collapsed) */}
      {!evidencePanelOpen && (
        <Box sx={{ position: 'relative' }}>
          <EvidenceToggleButton onClick={handleToggleEvidencePanel}>
            <Badge badgeContent={allEvidence.length} color="primary">
              <ChevronLeftIcon />
            </Badge>
          </EvidenceToggleButton>
        </Box>
      )}

      {/* Evidence Sidebar */}
      <EvidenceSidebar isOpen={evidencePanelOpen}>
        {evidencePanelOpen && (
            <EvidencePanel
                evidence={allEvidence}
                onNavigateToEvidence={handleNavigateToEvidence}
                onClose={handleToggleEvidencePanel}
            />
        )}
      </EvidenceSidebar>



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