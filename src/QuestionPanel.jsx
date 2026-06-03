import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  TextField,
  Button,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { mockQuestionAPI } from './api';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  margin: theme.spacing(2),
  maxHeight: '80vh',
  overflowY: 'auto',
}));

const QuestionInput = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const AnswerBox = styled(Box)(({ theme }) => ({
  marginTop: theme. spacing(2),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
  borderRadius: theme. shape.borderRadius,
}));

/**
 * Extract item ID from manifest URL
 * e.g., "http://localhost:8083/iiif_manifest/item:3267264/manifest/..." => "item:3267264"
 */
function extractItemId(manifestId) {
  if (!manifestId) return '';

  // If it's already just the item ID (e.g., "item:3267264"), return as-is
  if (manifestId. startsWith('item:')) {
    return manifestId;
  }

  // Extract from URL:  find "item: XXXX" pattern
  const match = manifestId.match(/item:\d+/);
  return match ? match[0] : manifestId;
}

/**
 * QuestionPanel component for asking questions about the manifest
 */
export function QuestionPanel({ manifestId, windowId }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useMockAPI, setUseMockAPI] = useState(false);

  const handleQuestionChange = (event) => {
    setQuestion(event.target.value);
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      // Extract just the item ID from the manifest URL
      const itemId = extractItemId(manifestId);

      // Build the full API endpoint with item ID
      const baseEndpoint = import.meta.env.VITE_API_ENDPOINT || '/api/chat';
      const apiEndpoint = `${baseEndpoint}/${itemId}/`;

      let data;

      // Try to use real API first
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body:  JSON.stringify({
            question,
            windowId,
          }),
        });

        if (!response.ok) {
          throw new Error('API not available');
        }

        data = await response. json();
      } catch (apiError) {
        // Fall back to mock API
        console.warn('Real API not available, using mock API:', apiError.message);
        setUseMockAPI(true);
        data = await mockQuestionAPI(manifestId, question);
      }

      setAnswer(data.answer || 'No answer received');
    } catch (err) {
      setError(err.message || 'An error occurred while processing your question');
      console.error('Question API error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
      <StyledPaper elevation={3}>
        <Typography variant="h6" gutterBottom>
          Ask a Question
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Ask questions about this manifest using semantic search and AI
        </Typography>

        {useMockAPI && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Using mock API.  Configure VITE_API_ENDPOINT in . env for real backend.
            </Alert>
        )}

        <QuestionInput
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            label="Your Question"
            placeholder="e.g., What is this document about?"
            value={question}
            onChange={handleQuestionChange}
            onKeyPress={handleKeyPress}
            disabled={loading}
        />

        <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={loading || !question.trim()}
            fullWidth
        >
          {loading ? <CircularProgress size={24} /> :  'Ask Question'}
        </Button>

        {error && (
            <Box mt={2}>
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            </Box>
        )}

        {answer && (
            <AnswerBox>
              <Typography variant="subtitle2" gutterBottom>
                Answer:
              </Typography>
              <Typography variant="body1">
                {answer}
              </Typography>
            </AnswerBox>
        )}
      </StyledPaper>
  );
}

QuestionPanel.propTypes = {
  manifestId: PropTypes.string,
  windowId: PropTypes. string.isRequired,
};