import React from 'react';
import { Chip } from '@mui/material';
import { STATUS_META } from './voucherMeta';

const StatusBadge: React.FC<{ status: string; size?: 'small' | 'medium' }> = ({ status, size = 'small' }) => {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <Chip
      label={meta.label}
      size={size}
      sx={{
        bgcolor: meta.bg,
        color: meta.fg,
        fontWeight: 700,
        letterSpacing: '0.02em',
        border: '1px solid',
        borderColor: `${meta.fg}33`,
      }}
    />
  );
};

export default StatusBadge;
