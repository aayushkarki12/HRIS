import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'contained' | 'outlined' | 'text';
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: Action;
  secondaryAction?: Action;
  compact?: boolean;
}

// Minimal, purposeful SVG illustrations per variant
const illustrations: Record<string, React.ReactNode> = {
  default: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="16" width="48" height="36" rx="4" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5"/>
      <rect x="16" y="24" width="32" height="3" rx="1.5" fill="#C7D2FE"/>
      <rect x="16" y="31" width="24" height="3" rx="1.5" fill="#E0E7FF"/>
      <rect x="16" y="38" width="20" height="3" rx="1.5" fill="#E0E7FF"/>
      <circle cx="48" cy="44" r="10" fill="#4F46E5"/>
      <path d="M44 44h8M48 40v8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  search: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="28" r="16" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5"/>
      <circle cx="28" cy="28" r="8" fill="#E0E7FF"/>
      <path d="M39 39l10 10" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M25 28h6M28 25v6" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  folder: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 24C8 20.686 10.686 18 14 18H26L30 22H50C53.314 22 56 24.686 56 28V46C56 49.314 53.314 52 50 52H14C10.686 52 8 49.314 8 46V24Z" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1.5"/>
      <path d="M24 37h16M32 33v8" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          py: compact ? 4 : 7,
          px: 3,
        }}
      >
        {/* Icon / Illustration */}
        <Box sx={{ mb: compact ? 1.5 : 2.5, opacity: 0.9 }}>
          {icon ?? illustrations.default}
        </Box>

        {/* Title */}
        <Typography
          variant={compact ? 'body1' : 'h6'}
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            letterSpacing: '-0.01em',
            mb: description ? 0.75 : 0,
          }}
        >
          {title}
        </Typography>

        {/* Description */}
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 340, lineHeight: 1.6, mb: (action || secondaryAction) ? 3 : 0 }}
          >
            {description}
          </Typography>
        )}

        {/* Actions */}
        {(action || secondaryAction) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {action && (
              <Button
                variant={action.variant ?? 'contained'}
                onClick={action.onClick}
                size={compact ? 'small' : 'medium'}
                sx={{ fontWeight: 600, minWidth: 140 }}
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant ?? 'text'}
                onClick={secondaryAction.onClick}
                size="small"
                sx={{ color: 'text.secondary', fontWeight: 500 }}
              >
                {secondaryAction.label}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

export default EmptyState;
