import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Divider,
  Paper,
  IconButton,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SortIcon from '@mui/icons-material/Sort';
import CloseIcon from '@mui/icons-material/Close';
import { EvidenceItem } from './EvidenceItem';

const PanelContainer = styled(Paper)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}));

const EvidenceList = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  overflowY: 'auto',
  flexGrow: 1,
}));

const SortControls = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

/**
 * Evidence panel component for displaying annotation evidence
 */
export function EvidencePanel({ evidence = [], onNavigateToEvidence, onClose }) {
  const [sortBy, setSortBy] = useState('relevance');

  const handleSortChange = (event) => {
    setSortBy(event.target.value);
  };

  const sortedEvidence = [...evidence].sort((a, b) => {
    switch (sortBy) {
      case 'relevance':
        return (b.relevance_score || 0) - (a.relevance_score || 0);
      case 'canvas':
        return (a.canvas_label || a.canvas_id || '').localeCompare(
          b.canvas_label || b.canvas_id || ''
        );
      case 'order':
        // Keep original order
        return 0;
      default:
        return 0;
    }
  });

  const handleCopyEvidence = (evidenceItem) => {
    console.log('Copied evidence:', evidenceItem.id);
  };

  return (
    <PanelContainer elevation={2}>
      <PanelHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">
            Evidence
          </Typography>
          {evidence.length > 0 && (
            <Typography variant="caption" color="textSecondary">
              ({evidence.length} {evidence.length === 1 ? 'item' : 'items'})
            </Typography>
          )}
        </Box>
        
        {onClose && (
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </PanelHeader>

      {evidence.length > 0 && (
        <SortControls>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SortIcon fontSize="small" color="action" />
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={sortBy}
                onChange={handleSortChange}
                displayEmpty
                inputProps={{ 'aria-label': 'Sort evidence' }}
              >
                <MenuItem value="relevance">Relevance</MenuItem>
                <MenuItem value="canvas">Canvas</MenuItem>
                <MenuItem value="order">Order Found</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </SortControls>
      )}

      <EvidenceList>
          {evidence.length === 0 ? (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                minHeight: 200,
              }}
            >
              <Typography variant="body2" color="textSecondary" align="center">
                No evidence yet.<br />
                Ask a question to see supporting annotations.
              </Typography>
            </Box>
          ) : (
            sortedEvidence.map((item) => (
              <EvidenceItem
                key={item.id || item.canvas_id}
                evidence={item}
                onNavigate={onNavigateToEvidence}
                onCopy={handleCopyEvidence}
              />
            ))
          )}
        </EvidenceList>
    </PanelContainer>
  );
}

EvidencePanel.propTypes = {
  evidence: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    canvas_id: PropTypes.string,
    canvas_label: PropTypes.string,
    content: PropTypes.string,
    relevance_score: PropTypes.number,
    annotation: PropTypes.object,
  })),
  onNavigateToEvidence: PropTypes.func,
  onClose: PropTypes.func,
};
