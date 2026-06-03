import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';

/** Detect image-context evidence and extract the image URL */
function parseImageContext(text, annotationId) {
  if (text && text.startsWith('Image context: ')) {
    return text.slice('Image context: '.length).trim();
  }
  if (annotationId && annotationId.startsWith('image:')) {
    return annotationId.slice('image:'.length).trim();
  }
  return null;
}

const EvidenceCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
  cursor: 'pointer',
  transition: 'all 0.2s',
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-2px)',
  },
}));

const RelevanceBar = styled(LinearProgress)(({ theme }) => ({
  height: 6,
  borderRadius: 3,
  marginTop: theme.spacing(1),
}));

const EvidenceHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(1),
}));

const EvidenceContent = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
}));

/**
 * Evidence item component showing individual annotation evidence
 */
export function EvidenceItem({ evidence, onNavigate, onCopy }) {
  const {
    id,
    annotation_id,
    canvas_id,
    text,
    relevance_score,
    annotation,
  } = evidence;

  const [copied, setCopied] = useState(false);

  const imageUrl = parseImageContext(text, annotation_id);
  const isImageContext = !!imageUrl;

  const handleNavigate = () => {
    if (onNavigate) onNavigate(evidence);
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (onCopy) onCopy(evidence);
    const copyText = isImageContext
      ? `Image context: ${imageUrl}\n\nCanvas: ${canvas_id || ''}`
      : `${text ? text.substring(0, 100) : 'No text'}\n\nSource: Canvas\nRelevance: ${Math.round((relevance_score || 0) * 100)}%`;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const relevancePercent = Math.round((relevance_score || 0) * 100);
  const textPreview = text ? text.substring(0, 50) : 'No text available';

  return (
    <EvidenceCard onClick={handleNavigate} elevation={1}>
      {/* Inline image preview for image-context evidence */}
      {isImageContext && (
        <CardMedia
          component="img"
          image={imageUrl}
          alt="Canvas image context"
          sx={{
            maxHeight: 200,
            objectFit: 'contain',
            backgroundColor: 'grey.900',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        />
      )}

      <CardContent>
        <EvidenceHeader>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {isImageContext ? (
              <Chip
                icon={<ImageSearchIcon fontSize="small" />}
                label="Image context"
                size="small"
                color="primary"
                variant="outlined"
              />
            ) : (
              <Tooltip title={text || 'No text'}>
                <Chip
                  label={textPreview + (text && text.length > 50 ? '...' : '')}
                  size="small"
                  variant="outlined"
                />
              </Tooltip>
            )}
            {relevance_score !== undefined && (
              <Chip
                label={`${relevancePercent}% relevant`}
                size="small"
                color={relevancePercent > 70 ? 'success' : 'default'}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
              <IconButton size="small" onClick={handleCopy} color={copied ? 'success' : 'default'}>
                {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Jump to canvas">
              <IconButton size="small" onClick={handleNavigate}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </EvidenceHeader>

        {relevance_score !== undefined && (
          <RelevanceBar
            variant="determinate"
            value={relevancePercent}
            color={relevancePercent > 70 ? 'success' : 'primary'}
          />
        )}

        <Box mt={1}>
          <Button size="small" variant="text" endIcon={<OpenInNewIcon />} onClick={handleNavigate}>
            View on Canvas
          </Button>
        </Box>
      </CardContent>
    </EvidenceCard>
  );
}

EvidenceItem.propTypes = {
  evidence: PropTypes.shape({
    id: PropTypes.string,
    annotation_id: PropTypes.string,
    canvas_id: PropTypes.string,
    text: PropTypes.string,
    relevance_score: PropTypes.number,
    annotation: PropTypes.object,
  }).isRequired,
  onNavigate: PropTypes.func,
  onCopy: PropTypes.func,
};
