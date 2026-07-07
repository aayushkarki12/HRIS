import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Skeleton, Chip, Paper,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { voucherService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from './vouchers/StatusBadge';
import { VOUCHER_TYPES, voucherMeta, money } from './vouchers/voucherMeta';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.03 } }),
};

const Vouchers: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['vouchers', activeType, statusFilter],
    queryFn: () => voucherService.getAll({
      voucher_type: activeType ?? undefined,
      status: statusFilter ?? undefined,
    }),
    enabled: isManager,
  });

  if (!isManager) {
    return <AccessDenied />;
  }

  const countsByType = (type: string) => vouchers.filter((v: any) => v.voucher_type === type).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Vouchers</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Every accounting transaction as a standardized document — Payment, Receipt, Contra, Journal, Sales, Purchase, Credit &amp; Debit Notes
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/vouchers/new')}>
            New Voucher
          </Button>
        )}
      </Box>

      {/* Voucher type cards */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
        gap: 1.5, mb: 3,
      }}>
        {VOUCHER_TYPES.map((v, i) => (
          <motion.div key={v.value} custom={i} variants={fadeUp} initial="hidden" animate="visible">
            <Card
              onClick={() => setActiveType(activeType === v.value ? null : v.value)}
              sx={{
                borderRadius: 2, cursor: 'pointer', boxShadow: 'none',
                border: '1px solid', borderColor: activeType === v.value ? v.color : 'divider',
                bgcolor: activeType === v.value ? `${v.color}0D` : '#fff',
                transition: 'all 0.15s',
                '&:hover': { borderColor: v.color, boxShadow: 2 },
              }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ p: 0.5, borderRadius: '8px', bgcolor: `${v.color}1A`, display: 'flex' }}>
                    <v.icon sx={{ fontSize: 16, color: v.color }} />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: v.color }}>{v.short}</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {isLoading ? <Skeleton width={24} /> : countsByType(v.value)}
                </Typography>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </Box>

      {/* Status filter chips */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {['draft', 'submitted', 'approved', 'posted', 'rejected', 'cancelled'].map((s) => (
          <Chip
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            color={statusFilter === s ? 'primary' : 'default'}
            variant={statusFilter === s ? 'filled' : 'outlined'}
            size="small"
          />
        ))}
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F8FAFC' }}>
              <TableCell><strong>Voucher #</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Party</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell align="right"><strong>Amount</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : vouchers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ border: 0 }}>
                  <EmptyState
                    title="No vouchers yet"
                    description="Create a voucher to record a payment, receipt, sale, purchase, or adjustment."
                    action={isAdmin ? { label: 'New Voucher', onClick: () => navigate('/vouchers/new') } : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              vouchers.map((v: any) => {
                const meta = voucherMeta(v.voucher_type);
                return (
                  <TableRow key={v.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/vouchers/${v.id}`)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: meta.color }}>
                        {v.voucher_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <meta.icon sx={{ fontSize: 15, color: meta.color }} />
                        <Typography variant="body2">{meta.short}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{new Date(v.voucher_date).toLocaleDateString()}</TableCell>
                    <TableCell>{v.party_name || '-'}</TableCell>
                    <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.journal_entry?.description}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{money(v.total_debit ?? 0, v.currency)}</Typography>
                    </TableCell>
                    <TableCell><StatusBadge status={v.status} /></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Vouchers;
