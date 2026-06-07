import { useState, useCallback, useRef, useEffect } from 'react';
import { mockStreamingAPI } from '../api/mockStreamingAPI';

/**
 * Hook for managing conversation state and streaming SSE events
 * @param {string} manifestId - The IIIF manifest ID
 * @param {Object} options - Configuration options
 * @param {string} options.scope - Search scope: 'manifest' | 'canvas'
 * @param {string} options.canvasId - Current canvas ID (if scope is 'canvas')
 * @param {boolean} options.useImageContext - Whether to include the current canvas image
 * @param {boolean} options.useMetadataContext - Whether to include manifest metadata
 * @param {object|null} options.engine - Optional WebLLM engine for in-browser inference
 * @param {string|null} options.canvasImageUrl - Resolved image URL for the current canvas
 * @param {string} options.modelId - WebLLM model identifier (used when engine is set)
 * @returns {Object} Conversation state and methods
 */
export function useConversation(manifestId, options = {}) {
  const {
    scope = 'manifest',
    canvasId = null,
    useImageContext = false,
    useMetadataContext = false,
    engine = null,
    canvasImageUrl = null,
    modelId = '',
  } = options;
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const eventSourceRef = useRef(null);
  const abortControllerRef = useRef(null);
  const canvasIdRef = useRef(canvasId);
  const prevCanvasIdRef = useRef(canvasId); // track previous to detect changes

  // Update canvasIdRef when canvasId changes
  useEffect(() => {
    canvasIdRef.current = canvasId;
  }, [canvasId]);

  // Generate a unique session ID
  function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  const [sessionId, setSessionId] = useState(() => {
    // Check if sessionId exists in sessionStorage
    const stored = sessionStorage.getItem('chatSessionId');
    if (stored) {
      return stored;
    }
    // Generate new one and store it
    const newId = generateSessionId();
    sessionStorage.setItem('chatSessionId', newId);
    return newId;
  });

  // Reset session when canvas changes (skip on initial mount)
  useEffect(() => {
    if (prevCanvasIdRef.current !== canvasId) {
      prevCanvasIdRef.current = canvasId;
      if (canvasId) {
        // Cancel any in-flight request
        if (abortControllerRef.current) abortControllerRef.current.abort();
        // Start a fresh session for the new canvas
        const newId = generateSessionId();
        sessionStorage.setItem('chatSessionId', newId);
        setSessionId(newId);
        setMessages([]);
        setError(null);
        setStreamingMessage(null);
      }
    }
  }, [canvasId]);

  // Load conversation history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`conversation-${sessionId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setMessages(data.messages || []);
      } catch (err) {
        console.error('Failed to load conversation:', err);
      }
    }
  }, [sessionId]);

  // Save conversation to localStorage
  const saveConversation = useCallback(() => {
    const data = {
      messages,
      sessionId,
      manifestId,
      timestamp: new Date().toISOString(),
      scope,
      canvasId: canvasIdRef.current,
    };
    localStorage.setItem(`conversation-${sessionId}`, JSON.stringify(data));
  }, [messages, sessionId, manifestId, scope]);

  // Auto-save on message changes
  useEffect(() => {
    if (messages.length > 0) {
      saveConversation();
    }
  }, [messages, saveConversation]);

  // Add message to history
  const addMessage = useCallback((message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Clear conversation and start new session
  const clearHistory = useCallback(() => {
    setMessages([]);
    setSessionId(generateSessionId());
    setError(null);
    setStreamingMessage(null);
  }, []);

  // Load a previous conversation
  const loadConversation = useCallback((loadedSessionId) => {
    const saved = localStorage.getItem(`conversation-${loadedSessionId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setMessages(data.messages || []);
        setSessionId(loadedSessionId);
        setError(null);
      } catch (err) {
        setError('Failed to load conversation');
        console.error('Failed to load conversation:', err);
      }
    }
  }, []);

  // Handle streaming response with SSE
  const sendQuestion = useCallback(async (question) => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    // Add user message
    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

    // Log the question and canvas context
    console.log('[Chat Plugin] Sending question:', {
      question: question,
      scope: scope,
      canvasId: canvasIdRef.current,
      sessionId: sessionId,
      manifestId: manifestId,
    });

    setIsLoading(true);
    setError(null);
    setStreamingMessage({
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      evidence: [],
      timestamp: new Date().toISOString(),
    });

    try {
      // ── WebLLM in-browser path ───────────────────────────────────────────
      if (engine) {
        await handleWebLLMQuestion({
          engine,
          modelId,
          question,
          messages,
          useImageContext,
          canvasImageUrl,
          streamingMessageRef: { current: streamingMessage },
          setStreamingMessage,
          addMessage,
          abortControllerRef,
        });
        return;
      }

      // ── Remote backend / mock path ───────────────────────────────────────
      const baseEndpoint = import.meta.env.VITE_API_ENDPOINT || '/api/chat';
      const external = isExternalManifest(manifestId);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      let response;
      let useMockAPI = false;

      try {
        if (external) {
          // External manifest: single JSON endpoint, no item-ID path
          const apiEndpoint = `${baseEndpoint}/external`;
          response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              manifest_url: manifestId,
              question,
              scope,
              canvas_id: canvasIdRef.current,
              use_image_context: useImageContext,
              use_metadata_context: useMetadataContext,
              image_url: canvasImageUrl,
            }),
            signal: abortControllerRef.current.signal,
          });
        } else {
          // Internal manifest: streaming SSE endpoint
          const itemId = extractItemId(manifestId);
          const apiEndpoint = `${baseEndpoint}/${itemId}/stream`;
          response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
            },
            body: JSON.stringify({
              question,
              scope,
              canvas_id: canvasIdRef.current,
              session_id: sessionId,
              use_image_context: useImageContext,
              use_metadata_context: useMetadataContext,
              image_url: canvasImageUrl,
              conversation_history: messages.map(m => ({
                role: m.role,
                content: m.content,
              })),
            }),
            signal: abortControllerRef.current.signal,
          });
        }

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
      } catch (apiError) {
        console.warn('Real API not available, using mock streaming API:', apiError.message);
        useMockAPI = true;
        response = await mockStreamingAPI(question);
      }

      // --- External manifest: handle plain JSON response ---
      if (external && !useMockAPI) {
        const data = await response.json();
        const finalMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.answer || 'No answer received',
          evidence: data.evidence || [],
          timestamp: new Date().toISOString(),
        };
        addMessage(finalMessage);
        setStreamingMessage(null);
        return;
      }

      // --- Internal manifest (or mock): handle SSE streaming response ---
      if (!response.body) {
        throw new Error('Streaming not supported');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentContent = '';
      let currentEvidence = [];
      let chunkCount = 0;

      console.debug('[useConversation] Starting to read stream', {
        timestamp: new Date().toISOString(),
      });

      while (true) {
        const { done, value } = await reader.read();

        chunkCount++;

        console.debug('[useConversation] Received chunk', {
          chunkNumber: chunkCount,
          chunkSize: value?.length,
          done,
          timestamp: new Date().toISOString(),
        });

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            let event;
            try {
              event = JSON.parse(data);
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError, 'Raw data:', data);
              continue;
            }

            try {
              switch (event.type) {
                case 'start':
                  // Initialize streaming
                  break;

                case 'text_chunk':
                  currentContent += event.content || '';
                  console.debug('[useConversation] Text chunk received', {
                    contentLength: currentContent.length,
                    chunkContent: event.content?.substring(0, 50),
                    timestamp: new Date().toISOString(),
                  });
                  setStreamingMessage(prev => ({
                    ...prev,
                    content: currentContent,
                  }));
                  break;

                case 'evidence': {
                  // Handle both 'evidence' and 'items' property names
                  const evidenceData = event.evidence || event.items || [];
                  if (evidenceData && evidenceData.length > 0) {
                    currentEvidence = evidenceData;
                    setStreamingMessage(prev => ({
                      ...prev,
                      evidence: currentEvidence,
                    }));
                  }
                  break;
                }

                case 'done': {
                  // Finalize the message when backend sends 'done' event
                  const finalMessage = {
                    id: streamingMessage?.id || `msg-${Date.now()}`,
                    role: 'assistant',
                    content: currentContent,
                    evidence: currentEvidence,
                    timestamp: new Date().toISOString(),
                  };
                  addMessage(finalMessage);
                  setStreamingMessage(null);
                  break;
                }

                case 'error':
                  // Backend explicitly signalled an error — propagate it
                  throw new Error(event.message || event.error || 'The server returned an error');

                default:
                  console.warn('Unknown SSE event type:', event.type, event);
              }
            } catch (eventError) {
              // Re-throw so the outer catch sets error state for the user
              throw eventError;
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request cancelled');
      } else {
        setError(err.message || 'Failed to send question');
        console.error('Send question error:', err);
      }
      setStreamingMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [manifestId, scope, sessionId, messages, addMessage, streamingMessage, useImageContext, useMetadataContext, engine, modelId, canvasImageUrl]);

  // Cancel streaming request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsLoading(false);
    setStreamingMessage(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    streamingMessage,
    isLoading,
    error,
    sessionId,
    sendQuestion,
    addMessage,
    clearHistory,
    saveConversation,
    loadConversation,
    cancelRequest,
  };
}

/**
 * Handles a question using an in-browser WebLLM engine.
 * Streams token deltas into the same state shape the SSE path uses.
 */
async function handleWebLLMQuestion({
  engine,
  modelId,
  question,
  messages,
  useImageContext,
  canvasImageUrl,
  streamingMessageRef,
  setStreamingMessage,
  addMessage,
  abortControllerRef,
}) {
  // Build the user message content.  Vision models accept an array of content
  // parts; text-only models accept a plain string.
  let userContent;
  if (useImageContext && canvasImageUrl) {
    userContent = [
      { type: 'text', text: question },
      { type: 'image_url', image_url: { url: canvasImageUrl } },
    ];
  } else {
    userContent = question;
  }

  // Translate conversation history into OpenAI message format
  const historyMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const chatMessages = [
    ...historyMessages,
    { role: 'user', content: userContent },
  ];

  // Create a fresh abort controller for cancellation support
  abortControllerRef.current = new AbortController();

  let currentContent = '';

  const stream = await engine.chat.completions.create({
    model: modelId,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    // Respect cancellation
    if (abortControllerRef.current?.signal?.aborted) break;

    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) {
      currentContent += delta;
      setStreamingMessage(prev => ({
        ...prev,
        content: currentContent,
      }));
    }

    // finish_reason === 'stop' signals completion
    if (chunk.choices?.[0]?.finish_reason === 'stop') {
      break;
    }
  }

  // Finalise the message (no evidence from in-browser inference)
  const finalMessage = {
    id: streamingMessageRef.current?.id || `msg-${Date.now()}`,
    role: 'assistant',
    content: currentContent,
    evidence: [],
    timestamp: new Date().toISOString(),
  };
  addMessage(finalMessage);
  setStreamingMessage(null);
}

/**
 * Extract item ID from manifest URL
 */
function extractItemId(manifestId) {
  if (!manifestId) return '';
  if (manifestId.startsWith('item:')) {
    return manifestId;
  }
  const match = manifestId.match(/item:\d+/);
  return match ? match[0] : manifestId;
}

const KNOWN_DOMAINS = [
  'digitalcollections.universiteitleiden.nl',
  'catalogue.leidenuniv.nl',
  'localhost:8083'
];

/**
 * Returns true if the manifest URL is not hosted on a known Leiden domain.
 */
function isExternalManifest(manifestId) {
  if (!manifestId) return false;
  return !KNOWN_DOMAINS.some(domain => manifestId.includes(domain));
}

