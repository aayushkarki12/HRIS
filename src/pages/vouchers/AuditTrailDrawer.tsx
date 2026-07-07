import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Drawer, Box, Typography, IconButton, Divider, Skeleton, Chip,
} from '@mui/material';
import { Close as CloseIcon, History as HistoryIcon } from '@mui/icons-material';
import { auditLogService } from '../../services/api';
import { fmtDateTime, userName } from './voucherMeta';

const ACTION_LABELS: Record<string, string> = {
  create: 'Created', submit: 'Submitted for approval', approve: 'Approved',
  reject: 'Rejected', cancel: 'Cancelled', post: 'Posted to ledger',
};

interface Props {
  open: boolean;
  onClose: () => void;
  entityId: number;
}

const AuditTrailDrawer: React.FC<Props> = ({ open, onClose, entityId }) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-trail', 'voucher', entityId],
    queryFn: () => auditLogService.getByEntity('voucher', entityId),
    enabled: open && !!entityId,
  });

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 360, p: 3 }} role="region" aria-label="Voucher audit trail">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="action" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Audit Trail</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Close audit trail"><CloseIcon /></IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {isLoading ? (
          <>
            <Skeleton height={60} /><Skeleton height={60} /><Skeleton height={60} />
          </>
        ) : logs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No recorded activity yet.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {logs.map((log: any, i: number) => (
              <Box key={log.id} sx={{ display: 'flex', gap: 1.5, pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.5 }} />
                  {i < logs.length - 1 && <Box sx={{ width: '2px', flex: 1, bgcolor: 'divider', mt: 0.5 }} />}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Chip label={ACTION_LABELS[log.action] ?? log.action} size="small" sx={{ fontWeight: 700, mb: 0.5 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{userName(log.user)}</Typography>
                  <Typography variant="caption" color="text.secondary">{fmtDateTime(log.created_at)}</Typography>
                  {log.details && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{log.details}</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default AuditTrailDrawer;
