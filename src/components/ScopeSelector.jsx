import React from 'react';
import PropTypes from 'prop-types';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';

const ScopeSelectorContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
}));

const ScopeDescription = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(1),
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
}));

/**
 * Extract label string from IIIF label (can be string, object, or array)
 */
function getLabelString(label) {
  if (!label) return '';
  if (typeof label === 'string') return label;
  
  // Handle IIIF Presentation 3.0 labels (object with language keys)
  if (typeof label === 'object' && !Array.isArray(label)) {
    // Get first available language value
    const values = Object.values(label);
    if (values.length > 0) {
      if (Array.isArray(values[0])) {
        return values[0][0] || '';
      }
      return values[0] || '';
    }
    return '';
  }
  
  // Handle array labels
  if (Array.isArray(label)) {
    return label[0] || '';
  }
  
  return '';
}

/**
 * Scope selector component for choosing search scope
 */
export function ScopeSelector({ scope, onScopeChange, currentCanvas, disabled = false }) {
  const handleChange = (event) => {
    onScopeChange(event.target.value);
  };

  const getCanvasLabel = (canvas) => {
    if (!canvas) return '';
    const labelStr = getLabelString(canvas.label);
    return labelStr || `${String(canvas.index + 1).padStart(4, '0')}`;
  };

  const getScopeDescription = (selectedScope) => {
    switch (selectedScope) {
      case 'manifest':
        return 'Search across all pages in the manifest';
      case 'canvas':
        return currentCanvas 
          ? `Search only on current page: ${getCanvasLabel(currentCanvas)}`
          : 'Navigate to a page first to enable this option';
      case 'region':
        return 'Search within a selected region (coming soon)';
      default:
        return '';
    }
  };

  return (
    <ScopeSelectorContainer>
      <FormControl fullWidth size="small" disabled={disabled}>
        <InputLabel id="scope-select-label">Search Scope</InputLabel>
        <Select
          labelId="scope-select-label"
          id="scope-select"
          value={scope}
          label="Search Scope"
          onChange={handleChange}
        >
          <MenuItem value="manifest">Entire Manifest</MenuItem>
          <MenuItem value="canvas" disabled={!currentCanvas}>
            Current Page {currentCanvas ? `(${getCanvasLabel(currentCanvas)})` : ''}
          </MenuItem>
          <MenuItem value="region" disabled>
            Region (Coming Soon)
          </MenuItem>
        </Select>
        
        <ScopeDescription>
          {getScopeDescription(scope)}
        </ScopeDescription>
      </FormControl>
    </ScopeSelectorContainer>
  );
}

ScopeSelector.propTypes = {
  scope: PropTypes.oneOf(['manifest', 'canvas', 'region']).isRequired,
  onScopeChange: PropTypes.func.isRequired,
  currentCanvas: PropTypes.shape({
    id: PropTypes.string,
    index: PropTypes.number,
    label: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  }),
  disabled: PropTypes.bool,
};
