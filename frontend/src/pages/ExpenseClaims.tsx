import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
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
  Collapse,
  Skeleton,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SubmitIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Payment as PayIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AddCircleOutlined as AddLineIcon,
  RemoveCircleOutlined as RemoveLineIcon,
  Receipt as ReceiptIcon,
  Pending as PendingIcon,
  TaskAlt as PaidIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { expenseService, employeeService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const fmt = (n: number) =>
  `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'software', label: 'Software' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'communication', label: 'Communication' },
  { value: 'other', label: 'Other' },
];

const STATUS_FILTERS = ['all', 'draft', 'submitted', 'manager_approved', 'accounting_approved', 'paid', 'rejected'];

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  draft: 'default',
  submitted: 'warning',
  manager_approved: 'info',
  accounting_approved: 'info',
  paid: 'success',
  rejected: 'error',
};

const getStatusLabel = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface LineForm {
  description: string;
  amount: string;
  category: string;
}

const emptyLine: LineForm = { description: '', amount: '', category: '' };

const ExpenseClaims: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; action: 'reject' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [payTarget, setPayTarget] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], description: '' });
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }]);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expenseService.getAll(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
    queryClient.invalidateQueries({ queryKey: ['ledger'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => expenseService.create(data),
    onSuccess: () => { invalidate(); toast.success('Expense claim created'); handleCloseModal(); },
    onError: (e: any) => { const msg = getErrorMessage(e, 'Failed to create'); toast.error(msg); setError(msg); },
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => expenseService.submit(id),
    onSuccess: () => { invalidate(); toast.success('Claim submitted for approval'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const managerApproveMutation = useMutation({
    mutationFn: (id: number) => expenseService.managerApprove(id),
    onSuccess: () => { invalidate(); toast.success('Manager approved'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const accountingApproveMutation = useMutation({
    mutationFn: (id: number) => expenseService.accountingApprove(id),
    onSuccess: () => { invalidate(); toast.success('Accounting approved'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const payMutation = useMutation({
    mutationFn: (id: number) => expenseService.pay(id),
    onSuccess: () => { invalidate(); toast.success('Paid — journal entry created'); setPayTarget(null); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => expenseService.reject(id, reason),
    onSuccess: () => { invalidate(); toast.success('Claim rejected'); setRejectTarget(null); setRejectReason(''); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expenseService.delete(id),
    onSuccess: () => { invalidate(); toast.success('Claim deleted'); setDeleteTarget(null); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed')),
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ date: new Date().toISOString().split('T')[0], description: '' });
    setLines([{ ...emptyLine }]);
    setError('');
  };

  const handleLineChange = (index: number, field: keyof LineForm, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSubmitCreate = () => {
    setError('');
    const claimLines = lines
      .filter((l) => l.description && l.amount && l.category)
      .map((l) => ({ description: l.description, amount: parseFloat(l.amount), category: l.category }));
    if (claimLines.length === 0) { setError('At least one complete line item is required'); return; }
    createMutation.mutate({ date: formData.date, description: formData.description, lines: claimLines });
  };

  const getEmployeeName = (id: number) => {
    const emp = (employees as any[]).find((e) => e.id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : `#${id}`;
  };

  const getEmployeeInitials = (id: number) => {
    const emp = (employees as any[]).find((e) => e.id === id);
    return emp ? `${emp.first_name?.[0]}${emp.last_name?.[0]}` : '?';
  };

  const filtered = useMemo(
    () => statusFilter === 'all' ? (expenses as any[]) : (expenses as any[]).filter((e) => e.status === statusFilter),
    [expenses, statusFilter],
  );

  const totalAmount = (expenses as any[]).reduce((s, e) => s + e.total_amount, 0);
  const pendingCount = (expenses as any[]).filter((e) => ['submitted', 'manager_approved'].includes(e.status)).length;
  const paidCount = (expenses as any[]).filter((e) => e.status === 'paid').length;
  const lineTotal = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Expense Claims</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>Submit and manage expense reimbursements</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={() => setIsModalOpen(true)}>
            New Claim
          </Button>
        </Box>

        {/* Summary cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          {[
            { label: 'Total Claims', value: isLoading ? '—' : (expenses as any[]).length, icon: <ReceiptIcon sx={{ fontSize: 18, color: '#4F46E5' }} />, bg: '#EEF2FF' },
            { label: 'Pending', value: isLoading ? '—' : pendingCount, icon: <PendingIcon sx={{ fontSize: 18, color: '#D97706' }} />, bg: '#FFFBEB' },
            { label: 'Paid', value: isLoading ? '—' : paidCount, icon: <PaidIcon sx={{ fontSize: 18, color: '#16A34A' }} />, bg: '#F0FDF4' },
            { label: 'Total Amount', value: isLoading ? '—' : fmt(totalAmount), icon: <PayIcon sx={{ fontSize: 18, color: '#0891B2' }} />, bg: '#ECFEFF' },
          ].map((stat) => (
            <Paper key={stat.label} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ p: 1, borderRadius: '8px', bgcolor: stat.bg, flexShrink: 0 }}>{stat.icon}</Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                  {stat.label}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{stat.value}</Typography>
              </Box>
            </Paper>
          ))}
        </Box>

        {/* Filter chips */}
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((s) => (
            <Chip
              key={s}
              label={s === 'all' ? 'All' : getStatusLabel(s)}
              size="small"
              onClick={() => setStatusFilter(s)}
              color={statusFilter === s ? 'primary' : 'default'}
              variant={statusFilter === s ? 'filled' : 'outlined'}
              sx={{ fontWeight: 500, cursor: 'pointer' }}
            />
          ))}
        </Box>

        {/* Table */}
        <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width={40} />
                  <TableCell>Claim #</TableCell>
                  <TableCell>Employee</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}><Skeleton height={18} width={j === 5 ? 80 : '70%'} /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.length === 0
                  ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 6, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.disabled">No expense claims found</Typography>
                        </TableCell>
                      </TableRow>
                    )
                  : filtered.map((claim: any) => {
                      const isExpanded = expandedRow === claim.id;
                      return (
                        <React.Fragment key={claim.id}>
                          <TableRow hover sx={{ '& td': { borderBottom: isExpanded ? 'none' : undefined } }}>
                            <TableCell>
                              <IconButton size="small" onClick={() => setExpandedRow(isExpanded ? null : claim.id)}>
                                {isExpanded
                                  ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                                  : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                              </IconButton>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'text.secondary' }}>
                                {claim.claim_number}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 24, height: 24, fontSize: '0.65rem', fontWeight: 600, bgcolor: 'primary.main', flexShrink: 0 }}>
                                  {getEmployeeInitials(claim.employee_id)}
                                </Avatar>
                                <Typography variant="body2">{getEmployeeName(claim.employee_id)}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {new Date(claim.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {claim.description}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                {fmt(claim.total_amount)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={getStatusLabel(claim.status)} color={STATUS_COLOR[claim.status] ?? 'default'} size="small" sx={{ fontWeight: 500 }} />
                            </TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25 }}>
                                {claim.status === 'draft' && (
                                  <>
                                    <Tooltip title="Submit for approval">
                                      <IconButton size="small" color="primary" onClick={() => submitMutation.mutate(claim.id)}>
                                        <SubmitIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(claim.id)}>
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                                {claim.status === 'submitted' && (isAdmin || isManager) && (
                                  <>
                                    <Tooltip title="Manager approve">
                                      <IconButton size="small" color="success" onClick={() => managerApproveMutation.mutate(claim.id)}>
                                        <ApproveIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Reject">
                                      <IconButton size="small" color="error" onClick={() => setRejectTarget({ id: claim.id, action: 'reject' })}>
                                        <RejectIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                                {claim.status === 'manager_approved' && isAdmin && (
                                  <>
                                    <Tooltip title="Accounting approve">
                                      <IconButton size="small" color="success" onClick={() => accountingApproveMutation.mutate(claim.id)}>
                                        <ApproveIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Reject">
                                      <IconButton size="small" color="error" onClick={() => setRejectTarget({ id: claim.id, action: 'reject' })}>
                                        <RejectIcon sx={{ fontSize: 16 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                                {claim.status === 'accounting_approved' && isAdmin && (
                                  <Tooltip title="Mark as paid">
                                    <IconButton size="small" color="success" onClick={() => setPayTarget(claim.id)}>
                                      <PayIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>

                          {/* Expanded line items */}
                          <TableRow>
                            <TableCell colSpan={8} sx={{ py: 0 }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box sx={{ px: 6, py: 2, bgcolor: '#FAFAFA', borderBottom: '1px solid', borderColor: 'divider' }}>
                                  <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                                    Line Items
                                  </Typography>
                                  <Table size="small" sx={{ mt: 1 }}>
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Category</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {claim.lines?.map((line: any) => (
                                        <TableRow key={line.id}>
                                          <TableCell><Typography variant="body2">{line.description}</Typography></TableCell>
                                          <TableCell>
                                            <Chip label={line.category} size="small" variant="outlined" sx={{ textTransform: 'capitalize', height: 20, fontSize: '0.7rem' }} />
                                          </TableCell>
                                          <TableCell align="right">
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{fmt(line.amount)}</Typography>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow>
                                        <TableCell colSpan={2} sx={{ borderBottom: 'none' }}>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Total</Typography>
                                        </TableCell>
                                        <TableCell align="right" sx={{ borderBottom: 'none' }}>
                                          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(claim.total_amount)}</Typography>
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                  {claim.rejection_reason && (
                                    <Alert severity="error" sx={{ mt: 1.5 }}>Rejection reason: {claim.rejection_reason}</Alert>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Create dialog */}
        <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>New Expense Claim</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 1.5, mb: 2 }}>
              <TextField
                fullWidth label="Date" type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                size="small"
                placeholder="Purpose of this expense"
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.65rem', letterSpacing: '0.08em' }}>Line Items</Typography>
              <Button size="small" startIcon={<AddLineIcon sx={{ fontSize: 16 }} />} onClick={() => setLines([...lines, { ...emptyLine }])}>
                Add Item
              </Button>
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '40%' }}>Description</TableCell>
                    <TableCell sx={{ width: '28%' }}>Category</TableCell>
                    <TableCell sx={{ width: '22%' }} align="right">Amount</TableCell>
                    <TableCell sx={{ width: '10%' }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ py: 0.75 }}>
                        <TextField fullWidth size="small" value={line.description}
                          onChange={(e) => handleLineChange(i, 'description', e.target.value)}
                          placeholder="What was purchased" />
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <TextField select fullWidth size="small" value={line.category}
                          onChange={(e) => handleLineChange(i, 'category', e.target.value)}>
                          <MenuItem value="" disabled>Select</MenuItem>
                          {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <TextField fullWidth size="small" type="number" value={line.amount}
                          onChange={(e) => handleLineChange(i, 'amount', e.target.value)}
                          slotProps={{ htmlInput: { min: 0, step: 0.01 } }} />
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <IconButton size="small" color="error"
                          onClick={() => lines.length > 1 && setLines(lines.filter((_, j) => j !== i))}
                          disabled={lines.length <= 1}>
                          <RemoveLineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell colSpan={2} align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Total</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(lineTotal)}</Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleCloseModal} color="inherit">Cancel</Button>
            <Button variant="contained" onClick={handleSubmitCreate}
              disabled={!formData.description || !formData.date || lines.every((l) => !l.description || !l.amount || !l.category) || createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Claim'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reject dialog */}
        <Dialog open={!!rejectTarget} onClose={() => { setRejectTarget(null); setRejectReason(''); }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RejectIcon sx={{ fontSize: 18, color: 'error.main' }} />
              </Box>
              Reject Claim
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Optionally provide a reason so the employee knows what to correct.
            </Typography>
            <TextField fullWidth label="Reason (optional)" value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              size="small" multiline rows={2} placeholder="e.g. Missing receipts" />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setRejectTarget(null); setRejectReason(''); }} color="inherit">Cancel</Button>
            <Button variant="contained" color="error" disabled={rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason || undefined })}>
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Pay confirmation */}
        <Dialog open={!!payTarget} onClose={() => setPayTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Mark as Paid</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will mark the claim as paid and create a journal entry in the accounting ledger.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPayTarget(null)} color="inherit">Cancel</Button>
            <Button variant="contained" color="success" disabled={payMutation.isPending}
              onClick={() => payTarget && payMutation.mutate(payTarget)}>
              {payMutation.isPending ? 'Processing…' : 'Confirm Payment'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Delete Claim</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will permanently delete the draft claim. This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteTarget(null)} color="inherit">Cancel</Button>
            <Button variant="contained" color="error" disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </motion.div>
  );
};

export default ExpenseClaims;
