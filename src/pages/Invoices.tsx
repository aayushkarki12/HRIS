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
  Send as SendIcon,
  Payment as PaymentIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AddCircleOutlined as AddLineIcon,
  RemoveCircleOutlined as RemoveLineIcon,
} from '@mui/icons-material';
import { invoiceService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface LineForm { description: string; quantity: string; unit_price: string; }
const emptyLine: LineForm = { description: '', quantity: '1', unit_price: '' };

const Invoices: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    customer_name: '', customer_email: '', project_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '', tax_rate: '0',
  });
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }]);

  const [payForm, setPayForm] = useState({
    amount: '', payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer', reference: '',
  });

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceService.getAll(),
  });

  const { data: stats } = useQuery({
    queryKey: ['invoiceStats'],
    queryFn: invoiceService.getStats,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['invoiceStats'] });
    queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
    queryClient.invalidateQueries({ queryKey: ['ledger'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => invoiceService.create(data),
    onSuccess: () => { invalidate(); toast.success('Invoice created'); handleCloseModal(); },
    onError: (e: any) => { const msg = e.response?.data?.detail || 'Failed'; toast.error(msg); setError(msg); },
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => invoiceService.send(id),
    onSuccess: () => { invalidate(); toast.success('Invoice sent and journal entry created'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => invoiceService.recordPayment(id, data),
    onSuccess: () => { invalidate(); toast.success('Payment recorded'); setPayModalOpen(false); setPayForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'bank_transfer', reference: '' }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => invoiceService.cancel(id),
    onSuccess: () => { invalidate(); toast.success('Invoice cancelled'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoiceService.delete(id),
    onSuccess: () => { invalidate(); toast.success('Invoice deleted'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ customer_name: '', customer_email: '', project_id: '', issue_date: new Date().toISOString().split('T')[0], due_date: '', tax_rate: '0' });
    setLines([{ ...emptyLine }]);
    setError('');
  };

  const handleLineChange = (i: number, field: keyof LineForm, value: string) => {
    const updated = [...lines]; updated[i] = { ...updated[i], [field]: value }; setLines(updated);
  };

  const handleCreate = () => {
    setError('');
    const invoiceLines = lines.filter(l => l.description && l.unit_price).map(l => ({
      description: l.description, quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price),
    }));
    if (invoiceLines.length === 0) { setError('At least one line item required'); return; }
    createMutation.mutate({
      customer_name: formData.customer_name, customer_email: formData.customer_email || null,
      project_id: formData.project_id ? Number(formData.project_id) : null,
      issue_date: formData.issue_date, due_date: formData.due_date,
      tax_rate: parseFloat(formData.tax_rate) || 0, lines: invoiceLines,
    });
  };

  const getStatusColor = (s: string): 'default' | 'warning' | 'success' | 'error' | 'info' => {
    switch (s) {
      case 'draft': return 'default'; case 'sent': return 'info'; case 'paid': return 'success';
      case 'partially_paid': return 'warning'; case 'overdue': return 'error'; case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const subtotal = lines.reduce((s, l) => s + ((parseFloat(l.quantity) || 1) * (parseFloat(l.unit_price) || 0)), 0);
  const taxAmt = subtotal * ((parseFloat(formData.tax_rate) || 0) / 100);
  const filteredInvoices = invoices?.filter((i: any) => selectedStatus === 'all' || i.status === selectedStatus);

  if (!isManager) return <AccessDenied />;

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>Invoices</Typography>
          <Typography variant="body2" color="textSecondary">Create and manage customer invoices</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>Refresh</Button>
          {isAdmin && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsModalOpen(true)}>New Invoice</Button>}
        </Box>
      </Box>

      {/* Summary */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Invoiced', value: fmt(stats?.total_amount || 0), color: '#667eea' },
          { label: 'Total Received', value: fmt(stats?.total_paid || 0), color: '#2ecc71' },
          { label: 'Outstanding', value: fmt(stats?.outstanding || 0), color: '#e74c3c' },
          { label: 'Invoices', value: stats?.total_invoices || 0, color: '#3498db' },
        ].map((stat: any) => (
          <Paper key={stat.label} sx={{ p: 2, flex: { xs: '1 1 100%', sm: '1 1 calc(25% - 12px)' }, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>{stat.label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {['all', 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].map(s => (
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
              <TableCell><strong>Invoice #</strong></TableCell>
              <TableCell><strong>Customer</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell align="right"><strong>Total</strong></TableCell>
              <TableCell align="right"><strong>Paid</strong></TableCell>
              <TableCell align="right"><strong>Balance</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {(!filteredInvoices || filteredInvoices.length === 0) ? (
              <TableRow><TableCell colSpan={isAdmin ? 9 : 8} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No invoices found</Typography></TableCell></TableRow>
            ) : filteredInvoices.map((inv: any) => {
              const isExpanded = expandedRow === inv.id;
              const balance = inv.total_amount - inv.amount_paid;
              return (
                <React.Fragment key={inv.id}>
                  <TableRow hover>
                    <TableCell><IconButton size="small" onClick={() => setExpandedRow(isExpanded ? null : inv.id)}>{isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton></TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoice_number}</Typography></TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{new Date(inv.issue_date).toLocaleDateString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(inv.total_amount)}</TableCell>
                    <TableCell align="right" sx={{ color: '#2ecc71' }}>{fmt(inv.amount_paid)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: balance > 0 ? '#e74c3c' : '#2ecc71' }}>{fmt(balance)}</TableCell>
                    <TableCell><Chip label={getStatusLabel(inv.status)} color={getStatusColor(inv.status)} size="small" /></TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        {inv.status === 'draft' && (
                          <>
                            <IconButton size="small" color="primary" onClick={() => sendMutation.mutate(inv.id)} title="Send"><SendIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => { if (window.confirm('Delete?')) deleteMutation.mutate(inv.id); }} title="Delete"><DeleteIcon fontSize="small" /></IconButton>
                          </>
                        )}
                        {['sent', 'partially_paid'].includes(inv.status) && (
                          <IconButton size="small" color="success" onClick={() => { setPayInvoiceId(inv.id); setPayForm({ ...payForm, amount: String(balance) }); setPayModalOpen(true); }} title="Record Payment"><PaymentIcon fontSize="small" /></IconButton>
                        )}
                        {inv.status === 'sent' && inv.amount_paid === 0 && (
                          <IconButton size="small" color="error" onClick={() => { if (window.confirm('Cancel?')) cancelMutation.mutate(inv.id); }} title="Cancel"><CancelIcon fontSize="small" /></IconButton>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 4 }}>
                          <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                            <Box><Typography variant="caption" color="textSecondary">Due Date</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{new Date(inv.due_date).toLocaleDateString()}</Typography></Box>
                            <Box><Typography variant="caption" color="textSecondary">Subtotal</Typography><Typography variant="body2">{fmt(inv.subtotal)}</Typography></Box>
                            <Box><Typography variant="caption" color="textSecondary">Tax ({inv.tax_rate}%)</Typography><Typography variant="body2">{fmt(inv.tax_amount)}</Typography></Box>
                            {inv.customer_email && <Box><Typography variant="caption" color="textSecondary">Email</Typography><Typography variant="body2">{inv.customer_email}</Typography></Box>}
                          </Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Line Items</Typography>
                          <Table size="small">
                            <TableHead><TableRow><TableCell><strong>Description</strong></TableCell><TableCell align="right"><strong>Hours/Qty</strong></TableCell><TableCell align="right"><strong>Price</strong></TableCell><TableCell align="right"><strong>Amount</strong></TableCell></TableRow></TableHead>
                            <TableBody>
                              {inv.lines?.map((line: any) => (
                                <TableRow key={line.id}><TableCell>{line.description}</TableCell><TableCell align="right">{line.quantity}</TableCell><TableCell align="right">{fmt(line.unit_price)}</TableCell><TableCell align="right">{fmt(line.amount)}</TableCell></TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {inv.payments?.length > 0 && (
                            <>
                              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>Payments</Typography>
                              <Table size="small">
                                <TableHead><TableRow><TableCell><strong>Date</strong></TableCell><TableCell><strong>Method</strong></TableCell><TableCell><strong>Reference</strong></TableCell><TableCell align="right"><strong>Amount</strong></TableCell></TableRow></TableHead>
                                <TableBody>
                                  {inv.payments.map((p: any) => (
                                    <TableRow key={p.id}><TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell><TableCell sx={{ textTransform: 'capitalize' }}>{p.payment_method.replace('_', ' ')}</TableCell><TableCell>{p.reference || '-'}</TableCell><TableCell align="right" sx={{ color: '#2ecc71', fontWeight: 600 }}>{fmt(p.amount)}</TableCell></TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </>
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

      {/* Create Invoice Dialog */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>New Invoice</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField label="Customer Name" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} margin="normal" size="small" sx={{ flex: '1 1 250px' }} />
            <TextField label="Customer Email" value={formData.customer_email} onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })} margin="normal" size="small" sx={{ flex: '1 1 200px' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField select label="Project (Optional)" value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} margin="normal" size="small" sx={{ flex: '1 1 200px' }}>
              <MenuItem value="">No Project</MenuItem>
              {projects?.map((p: any) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            <TextField label="Issue Date" type="date" value={formData.issue_date} onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })} margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '0 0 160px' }} />
            <TextField label="Due Date" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '0 0 160px' }} />
            <TextField label="Tax Rate %" type="number" value={formData.tax_rate} onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })} margin="normal" size="small" sx={{ flex: '0 0 100px' }} slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 } }} />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Line Items</Typography>
            <Button size="small" startIcon={<AddLineIcon />} onClick={() => setLines([...lines, { ...emptyLine }])}>Add Item</Button>
          </Box>
          <Table size="small">
            <TableHead><TableRow><TableCell sx={{ width: '40%' }}><strong>Description</strong></TableCell><TableCell sx={{ width: '15%' }} align="right"><strong>Hours/Qty</strong></TableCell><TableCell sx={{ width: '20%' }} align="right"><strong>Unit Price</strong></TableCell><TableCell sx={{ width: '15%' }} align="right"><strong>Amount</strong></TableCell><TableCell sx={{ width: '10%' }}></TableCell></TableRow></TableHead>
            <TableBody>
              {lines.map((line, i) => {
                const lineAmt = (parseFloat(line.quantity) || 1) * (parseFloat(line.unit_price) || 0);
                return (
                  <TableRow key={i}>
                    <TableCell sx={{ py: 0.5 }}><TextField fullWidth size="small" value={line.description} onChange={(e) => handleLineChange(i, 'description', e.target.value)} placeholder="Service or product" /></TableCell>
                    <TableCell sx={{ py: 0.5 }}><TextField fullWidth size="small" type="number" value={line.quantity} onChange={(e) => handleLineChange(i, 'quantity', e.target.value)} slotProps={{ htmlInput: { min: 0.01, step: 1 } }} /></TableCell>
                    <TableCell sx={{ py: 0.5 }}><TextField fullWidth size="small" type="number" value={line.unit_price} onChange={(e) => handleLineChange(i, 'unit_price', e.target.value)} slotProps={{ htmlInput: { min: 0, step: 0.01 } }} /></TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(lineAmt)}</Typography></TableCell>
                    <TableCell sx={{ py: 0.5 }}><IconButton size="small" color="error" onClick={() => { if (lines.length > 1) setLines(lines.filter((_, j) => j !== i)); }} disabled={lines.length <= 1}><RemoveLineIcon fontSize="small" /></IconButton></TableCell>
                  </TableRow>
                );
              })}
              <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                <TableCell colSpan={3} align="right">Subtotal</TableCell>
                <TableCell align="right"><strong>{fmt(subtotal)}</strong></TableCell><TableCell></TableCell>
              </TableRow>
              <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                <TableCell colSpan={3} align="right">Tax ({formData.tax_rate}%)</TableCell>
                <TableCell align="right">{fmt(taxAmt)}</TableCell><TableCell></TableCell>
              </TableRow>
              <TableRow sx={{ backgroundColor: '#f0f0f0' }}>
                <TableCell colSpan={3} align="right"><strong>Total</strong></TableCell>
                <TableCell align="right"><Typography variant="body1" sx={{ fontWeight: 700 }}>{fmt(subtotal + taxAmt)}</Typography></TableCell><TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!formData.customer_name || !formData.issue_date || !formData.due_date || lines.every(l => !l.description || !l.unit_price) || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={payModalOpen} onClose={() => setPayModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Amount" type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} margin="normal" size="small" slotProps={{ htmlInput: { min: 0, step: 0.01 } }} />
          <TextField fullWidth label="Payment Date" type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth select label="Payment Method" value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })} margin="normal" size="small">
            <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="check">Check</MenuItem>
            <MenuItem value="online">Online</MenuItem>
          </TextField>
          <TextField fullWidth label="Reference" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} margin="normal" size="small" placeholder="Optional payment reference" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayModalOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!payForm.amount || !payForm.payment_date || payMutation.isPending}
            onClick={() => { if (payInvoiceId) payMutation.mutate({ id: payInvoiceId, data: { amount: parseFloat(payForm.amount), payment_date: payForm.payment_date, payment_method: payForm.payment_method, reference: payForm.reference || null } }); }}>
            {payMutation.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Invoices;
