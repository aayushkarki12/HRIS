import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  MenuItem,
  IconButton,
  Skeleton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  CheckCircle as ApprovedIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  EventBusy as RejectIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { leaveService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.2, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

type LeaveStatus = 'approved' | 'pending' | 'rejected' | 'cancelled';

const STATUS_META: Record<LeaveStatus, { color: 'success' | 'warning' | 'error' | 'default'; icon: React.ReactNode }> = {
  approved: { color: 'success', icon: <ApprovedIcon sx={{ fontSize: 14 }} /> },
  pending:  { color: 'warning', icon: <PendingIcon  sx={{ fontSize: 14 }} /> },
  rejected: { color: 'error',   icon: <CloseIcon    sx={{ fontSize: 14 }} /> },
  cancelled:{ color: 'default', icon: <CancelIcon   sx={{ fontSize: 14 }} /> },
};

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled'] as const;

const Leaves: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rejectTarget, setRejectTarget] = useState<{ id: number; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const { data: leaveTypes } = useQuery({ queryKey: ['leaveTypes'], queryFn: leaveService.getTypes });
  const { data: leaves = [], isLoading, error: leavesError } = useQuery({ queryKey: ['leaves'], queryFn: leaveService.getMyLeaves });
  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['pendingLeaves'],
    queryFn: leaveService.getPending,
    enabled: isAdmin,
  });
  const { data: balances = [], isLoading: balancesLoading } = useQuery({
    queryKey: ['leaveBalances'],
    queryFn: leaveService.getBalance,
    retry: (failCount, err: any) => err?.response?.status !== 404 && failCount < 2,
  });

  const calcBalancesMutation = useMutation({
    mutationFn: () => leaveService.calculateBalances(new Date().getFullYear()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      toast.success(data?.message || 'Leave balances calculated');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to calculate balances')),
  });

  const createMutation = useMutation({
    mutationFn: () => leaveService.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      toast.success('Leave request submitted');
      setIsModalOpen(false);
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      setError('');
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, 'Failed to submit leave request');
      toast.error(msg);
      setError(msg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: leaveService.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['pendingLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      toast.success('Leave approved');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to approve leave')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => leaveService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['pendingLeaves'] });
      toast.success('Leave rejected');
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to reject leave')),
  });

  const cancelMutation = useMutation({
    mutationFn: leaveService.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Leave cancelled');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to cancel leave')),
  });

  const filteredLeaves = useMemo(
    () => (statusFilter === 'all' ? leaves : (leaves as any[]).filter((l) => l.status === statusFilter)),
    [leaves, statusFilter],
  );

  const StatusChip = ({ status }: { status: string }) => {
    const meta = STATUS_META[status as LeaveStatus] ?? STATUS_META.pending;
    return (
      <Chip
        icon={meta.icon as React.ReactElement}
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        color={meta.color}
        size="small"
        sx={{ fontWeight: 500, '& .MuiChip-icon': { fontSize: 14 } }}
      />
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              Leave Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Request and manage your time off
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setIsModalOpen(true)}>
            Request Leave
          </Button>
        </Box>

        {/* Leave Balances */}
        <Typography variant="overline" color="text.disabled" sx={{ letterSpacing: '0.08em', mb: 1.5, display: 'block' }}>
          My Leave Balances
        </Typography>
        {(leavesError as any)?.response?.status === 404 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            No employee record is linked to your account. Ask an admin to create an employee record for you to track leave balances and history.
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
            mb: 4,
          }}
        >
          {balancesLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                  <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Skeleton width={80} height={14} sx={{ mb: 1 }} />
                    <Skeleton width={60} height={36} sx={{ mb: 1 }} />
                    <Skeleton height={6} sx={{ borderRadius: 3 }} />
                  </CardContent>
                </Card>
              ))
            : (balances as any[]).length === 0
            ? (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Alert
                    severity="info"
                    variant="outlined"
                    action={
                      isAdmin ? (
                        <Button
                          size="small"
                          color="inherit"
                          disabled={calcBalancesMutation.isPending}
                          onClick={() => calcBalancesMutation.mutate()}
                        >
                          {calcBalancesMutation.isPending ? 'Calculating…' : 'Calculate Now'}
                        </Button>
                      ) : undefined
                    }
                  >
                    Leave balances haven't been calculated yet for {new Date().getFullYear()}.
                    {!isAdmin && ' Ask an admin to run the balance calculation.'}
                  </Alert>
                </Box>
              )
            : (balances as any[]).map((balance, i) => {
                const used = balance.used_days ?? 0;
                const total = balance.total_days ?? 1;
                const pct = Math.round((used / total) * 100);
                return (
                  <motion.div key={balance.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
                    <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                          {balance.leave_type?.name ?? 'Leave'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.75 }}>
                          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>
                            {balance.remaining_days}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">/ {total} days</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            mt: 1.5, mb: 0.75, height: 4, borderRadius: 2,
                            bgcolor: 'action.hover',
                            '& .MuiLinearProgress-bar': { borderRadius: 2 },
                          }}
                        />
                        <Typography variant="caption" color="text.disabled">{used} used · {balance.remaining_days} remaining</Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
        </Box>

        {/* Pending requests — admin only */}
        {isAdmin && (pendingLeaves as any[]).length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Typography variant="overline" color="text.disabled" sx={{ letterSpacing: '0.08em' }}>
                Pending Approvals
              </Typography>
              <Chip label={(pendingLeaves as any[]).length} size="small" color="warning" sx={{ height: 18, fontSize: '0.7rem', fontWeight: 600 }} />
            </Box>
            <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Dates</TableCell>
                      <TableCell>Days</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(pendingLeaves as any[]).map((leave) => (
                      <TableRow key={leave.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {leave.employee?.first_name} {leave.employee?.last_name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{leave.leave_type?.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {fmt(leave.start_date)} – {fmt(leave.end_date)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{leave.total_days}d</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip title="Approve">
                              <IconButton
                                size="small"
                                color="success"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate(leave.id)}
                              >
                                <CheckIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setRejectTarget({
                                  id: leave.id,
                                  name: `${leave.employee?.first_name} ${leave.employee?.last_name}`,
                                })}
                              >
                                <CloseIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        )}

        {/* My Leave History */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="overline" color="text.disabled" sx={{ letterSpacing: '0.08em' }}>
            My Leave History
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {FILTERS.map((s) => (
              <Chip
                key={s}
                label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                size="small"
                onClick={() => setStatusFilter(s)}
                color={statusFilter === s ? 'primary' : 'default'}
                variant={statusFilter === s ? 'filled' : 'outlined'}
                sx={{ fontWeight: 500, cursor: 'pointer' }}
              />
            ))}
          </Box>
        </Box>

        <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Dates</TableCell>
                  <TableCell>Days</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton height={18} /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : (filteredLeaves as any[]).length > 0
                  ? (filteredLeaves as any[]).map((leave) => (
                      <TableRow key={leave.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{leave.leave_type?.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {fmt(leave.start_date)} – {fmt(leave.end_date)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{leave.total_days}d</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {leave.reason || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell><StatusChip status={leave.status} /></TableCell>
                        <TableCell align="right">
                          {leave.status === 'pending' && (
                            <Button
                              size="small"
                              color="error"
                              variant="text"
                              sx={{ fontSize: '0.75rem' }}
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(leave.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  : (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 5, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.disabled">
                          {statusFilter === 'all' ? 'No leave requests yet' : `No ${statusFilter} requests`}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Request Leave dialog */}
        <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Request Leave</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TextField
              fullWidth select
              label="Leave Type"
              name="leave_type_id"
              value={formData.leave_type_id}
              onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
              margin="normal"
              size="small"
            >
              <MenuItem value="" disabled>Select leave type</MenuItem>
              {(leaveTypes as any[] | undefined)?.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} ({t.days_per_year} days/year)
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
              <TextField
                fullWidth label="Start Date" type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth label="End Date" type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            <TextField
              fullWidth label="Reason (optional)"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              margin="normal"
              size="small"
              multiline rows={3}
              placeholder="Briefly describe your reason for leave"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIsModalOpen(false)} color="inherit">Cancel</Button>
            <Button
              variant="contained"
              disabled={!formData.leave_type_id || !formData.start_date || !formData.end_date || createMutation.isPending}
              onClick={() => { setError(''); createMutation.mutate(); }}
            >
              {createMutation.isPending ? 'Submitting…' : 'Submit Request'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reject confirmation dialog */}
        <Dialog open={!!rejectTarget} onClose={() => { setRejectTarget(null); setRejectReason(''); }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RejectIcon sx={{ fontSize: 18, color: 'error.main' }} />
              </Box>
              Reject Leave
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Rejecting leave request for <strong>{rejectTarget?.name}</strong>.
            </Typography>
            <TextField
              fullWidth label="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              size="small"
              multiline rows={2}
              placeholder="Let the employee know why"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setRejectTarget(null); setRejectReason(''); }} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason || undefined })}
            >
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </motion.div>
  );
};

export default Leaves;
