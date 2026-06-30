import React, { useState } from 'react';
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
  CircularProgress,
  Alert,
  MenuItem,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Send as SubmitIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Payment as PayIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AddCircleOutlined as AddLineIcon,
  RemoveCircleOutlined as RemoveLineIcon,
} from '@mui/icons-material';
import { expenseService, employeeService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'software', label: 'Software' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'communication', label: 'Communication' },
  { value: 'other', label: 'Other' },
];

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
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], description: '' });
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }]);

  const { data: expenses, isLoading, refetch } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expenseService.getAll(),
  });

  const { data: employees } = useQuery({
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
    onError: (e: any) => { const msg = e.response?.data?.detail || 'Failed'; toast.error(msg); setError(msg); },
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => expenseService.submit(id),
    onSuccess: () => { invalidate(); toast.success('Claim submitted for approval'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const managerApproveMutation = useMutation({
    mutationFn: (id: number) => expenseService.managerApprove(id),
    onSuccess: () => { invalidate(); toast.success('Manager approved'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const accountingApproveMutation = useMutation({
    mutationFn: (id: number) => expenseService.accountingApprove(id),
    onSuccess: () => { invalidate(); toast.success('Accounting approved'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const payMutation = useMutation({
    mutationFn: (id: number) => expenseService.pay(id),
    onSuccess: () => { invalidate(); toast.success('Paid and journal entry created'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => expenseService.reject(id, reason),
    onSuccess: () => { invalidate(); toast.success('Claim rejected'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expenseService.delete(id),
    onSuccess: () => { invalidate(); toast.success('Claim deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
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
    const claimLines = lines.filter(l => l.description && l.amount && l.category).map(l => ({
      description: l.description,
      amount: parseFloat(l.amount),
      category: l.category,
    }));
    if (claimLines.length === 0) { setError('At least one line item is required'); return; }
    createMutation.mutate({ date: formData.date, description: formData.description, lines: claimLines });
  };

  const getStatusColor = (s: string): 'default' | 'warning' | 'info' | 'success' | 'error' => {
    switch (s) {
      case 'draft': return 'default';
      case 'submitted': return 'warning';
      case 'manager_approved': return 'info';
      case 'accounting_approved': return 'info';
      case 'paid': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const getEmployeeName = (id: number) => {
    const emp = employees?.find((e: any) => e.id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : `#${id}`;
  };

  const filteredExpenses = expenses?.filter((e: any) => selectedStatus === 'all' || e.status === selectedStatus);
  const totalAmount = expenses?.reduce((s: number, e: any) => s + e.total_amount, 0) || 0;

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>Expense Claims</Typography>
          <Typography variant="body2" color="textSecondary">Submit and manage expense reimbursements</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>Refresh</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsModalOpen(true)}>New Claim</Button>
        </Box>
      </Box>

      {/* Summary */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Claims', value: expenses?.length || 0, color: '#667eea' },
          { label: 'Pending', value: expenses?.filter((e: any) => ['submitted', 'manager_approved'].includes(e.status)).length || 0, color: '#f39c12' },
          { label: 'Paid', value: expenses?.filter((e: any) => e.status === 'paid').length || 0, color: '#2ecc71' },
          { label: 'Total Amount', value: fmt(totalAmount), color: '#3498db', isText: true },
        ].map((stat: any) => (
          <Paper key={stat.label} sx={{ p: 2, flex: { xs: '1 1 100%', sm: '1 1 calc(25% - 12px)' }, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>{stat.label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>{stat.isText ? stat.value : stat.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filter Chips */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {['all', 'draft', 'submitted', 'manager_approved', 'accounting_approved', 'paid', 'rejected'].map((s) => (
          <Chip key={s} label={getStatusLabel(s)} onClick={() => setSelectedStatus(s)}
            color={selectedStatus === s ? 'primary' : 'default'} variant={selectedStatus === s ? 'filled' : 'outlined'} />
        ))}
      </Box>

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell width={40}></TableCell>
              <TableCell><strong>Claim #</strong></TableCell>
              <TableCell><strong>Employee</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell align="right"><strong>Amount</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(!filteredExpenses || filteredExpenses.length === 0) ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No expense claims found</Typography></TableCell></TableRow>
            ) : filteredExpenses.map((claim: any) => {
              const isExpanded = expandedRow === claim.id;
              return (
                <React.Fragment key={claim.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => setExpandedRow(isExpanded ? null : claim.id)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{claim.claim_number}</Typography></TableCell>
                    <TableCell>{getEmployeeName(claim.employee_id)}</TableCell>
                    <TableCell>{new Date(claim.date).toLocaleDateString()}</TableCell>
                    <TableCell>{claim.description}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(claim.total_amount)}</TableCell>
                    <TableCell><Chip label={getStatusLabel(claim.status)} color={getStatusColor(claim.status)} size="small" /></TableCell>
                    <TableCell align="right">
                      {claim.status === 'draft' && (
                        <>
                          <IconButton size="small" color="primary" onClick={() => submitMutation.mutate(claim.id)} title="Submit"><SubmitIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => { if (window.confirm('Delete?')) deleteMutation.mutate(claim.id); }} title="Delete"><DeleteIcon fontSize="small" /></IconButton>
                        </>
                      )}
                      {claim.status === 'submitted' && (isAdmin || isManager) && (
                        <>
                          <IconButton size="small" color="success" onClick={() => managerApproveMutation.mutate(claim.id)} title="Manager Approve"><ApproveIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => { const r = prompt('Rejection reason?'); rejectMutation.mutate({ id: claim.id, reason: r || undefined }); }} title="Reject"><RejectIcon fontSize="small" /></IconButton>
                        </>
                      )}
                      {claim.status === 'manager_approved' && isAdmin && (
                        <>
                          <IconButton size="small" color="success" onClick={() => accountingApproveMutation.mutate(claim.id)} title="Accounting Approve"><ApproveIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => { const r = prompt('Rejection reason?'); rejectMutation.mutate({ id: claim.id, reason: r || undefined }); }} title="Reject"><RejectIcon fontSize="small" /></IconButton>
                        </>
                      )}
                      {claim.status === 'accounting_approved' && isAdmin && (
                        <IconButton size="small" color="success" onClick={() => { if (window.confirm('Mark as paid?')) payMutation.mutate(claim.id); }} title="Pay"><PayIcon fontSize="small" /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 4 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Line Items</Typography>
                          <Table size="small">
                            <TableHead>
                              <TableRow><TableCell><strong>Description</strong></TableCell><TableCell><strong>Category</strong></TableCell><TableCell align="right"><strong>Amount</strong></TableCell></TableRow>
                            </TableHead>
                            <TableBody>
                              {claim.lines?.map((line: any) => (
                                <TableRow key={line.id}><TableCell>{line.description}</TableCell><TableCell><Chip label={line.category} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} /></TableCell><TableCell align="right">{fmt(line.amount)}</TableCell></TableRow>
                              ))}
                              <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                                <TableCell colSpan={2}><strong>Total</strong></TableCell>
                                <TableCell align="right"><strong>{fmt(claim.total_amount)}</strong></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                          {claim.rejection_reason && (
                            <Alert severity="error" sx={{ mt: 2 }}>Rejection reason: {claim.rejection_reason}</Alert>
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

      {/* Create Dialog */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>New Expense Claim</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField fullWidth label="Date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '0 0 200px' }} />
            <TextField fullWidth label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal" size="small" placeholder="Purpose of expense" />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Line Items</Typography>
            <Button size="small" startIcon={<AddLineIcon />} onClick={() => setLines([...lines, { ...emptyLine }])}>Add Item</Button>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '35%' }}><strong>Description</strong></TableCell>
                <TableCell sx={{ width: '25%' }}><strong>Category</strong></TableCell>
                <TableCell sx={{ width: '20%' }} align="right"><strong>Amount</strong></TableCell>
                <TableCell sx={{ width: '10%' }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField fullWidth size="small" value={line.description} onChange={(e) => handleLineChange(i, 'description', e.target.value)} placeholder="What was purchased" />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField select fullWidth size="small" value={line.category} onChange={(e) => handleLineChange(i, 'category', e.target.value)}>
                      <MenuItem value="">Select</MenuItem>
                      {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField fullWidth size="small" type="number" value={line.amount} onChange={(e) => handleLineChange(i, 'amount', e.target.value)} slotProps={{ htmlInput: { min: 0, step: 0.01 } }} />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <IconButton size="small" color="error" onClick={() => { if (lines.length > 1) setLines(lines.filter((_, j) => j !== i)); }} disabled={lines.length <= 1}><RemoveLineIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                <TableCell colSpan={2} align="right"><strong>Total</strong></TableCell>
                <TableCell align="right"><strong>{fmt(lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0))}</strong></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitCreate}
            disabled={!formData.description || !formData.date || lines.every(l => !l.description || !l.amount || !l.category) || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Claim'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExpenseClaims;
