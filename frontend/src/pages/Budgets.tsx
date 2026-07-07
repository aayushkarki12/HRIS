import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, IconButton, MenuItem, Grid, LinearProgress,
  Select, FormControl, InputLabel, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Send as SendIcon, CheckCircle as ApproveIcon,
  Cancel as RejectIcon, BarChart as VarianceIcon, Close as CloseIcon,
} from '@mui/icons-material';
import { budgetService, accountingService, employeeService, projectService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const SCOPE_TYPES = [
  { value: 'company', label: 'Company-wide' },
  { value: 'cost_center', label: 'Cost Center' },
  { value: 'project', label: 'Project' },
  { value: 'employee', label: 'Employee' },
];

const PERIOD_TYPES = [
  { value: 'annual', label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
];

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  draft: 'default', submitted: 'info', approved: 'success', rejected: 'error',
};

function buildPeriods(fiscalYear: number, periodType: string) {
  const periods: { period_label: string; period_start: string; period_end: string; amount: string }[] = [];
  if (periodType === 'annual') {
    periods.push({ period_label: `${fiscalYear}`, period_start: `${fiscalYear}-01-01`, period_end: `${fiscalYear}-12-31`, amount: '' });
  } else if (periodType === 'quarterly') {
    const starts = ['01-01', '04-01', '07-01', '10-01'];
    const ends = ['03-31', '06-30', '09-30', '12-31'];
    for (let q = 0; q < 4; q++) {
      periods.push({ period_label: `${fiscalYear}-Q${q + 1}`, period_start: `${fiscalYear}-${starts[q]}`, period_end: `${fiscalYear}-${ends[q]}`, amount: '' });
    }
  } else {
    const lastDay = (m: number) => new Date(fiscalYear, m, 0).getDate();
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      periods.push({ period_label: `${fiscalYear}-${mm}`, period_start: `${fiscalYear}-${mm}-01`, period_end: `${fiscalYear}-${mm}-${String(lastDay(m)).padStart(2, '0')}`, amount: '' });
    }
  }
  return periods;
}

const Budgets: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [varianceBudgetId, setVarianceBudgetId] = useState<number | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    name: '', fiscal_year: String(currentYear), period_type: 'annual', scope_type: 'company',
    scope_id: '', account_id: '', notes: '',
  });
  const [periods, setPeriods] = useState(() => buildPeriods(currentYear, 'annual'));

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetService.getBudgets(),
    enabled: isManager,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ['cost-centers-active'],
    queryFn: () => accountingService.getCostCenters({ is_active: true }),
    enabled: isManager && form.scope_type === 'cost_center',
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-budget'],
    queryFn: () => projectService.getAll(),
    enabled: isManager && form.scope_type === 'project',
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-budget'],
    queryFn: () => employeeService.getAll(),
    enabled: isManager && form.scope_type === 'employee',
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-for-budget'],
    queryFn: () => accountingService.getAccounts(),
    enabled: isManager && modalOpen,
  });

  const { data: variance, isLoading: varianceLoading } = useQuery({
    queryKey: ['budget-variance', varianceBudgetId],
    queryFn: () => budgetService.getVariance(varianceBudgetId as number),
    enabled: varianceBudgetId != null,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => budgetService.createBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget created');
      closeModal();
    },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to create budget')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => budgetService.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget deleted');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to delete budget')),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => budgetService.submitBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Submitted for approval');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to submit')),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => budgetService.approveBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget approved');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to approve')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: number; remarks: string }) => budgetService.rejectBudget(id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget rejected');
      setRejectTargetId(null);
      setRejectRemarks('');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to reject')),
  });

  if (!isManager) return <AccessDenied />;

  const openModal = () => {
    setForm({ name: '', fiscal_year: String(currentYear), period_type: 'annual', scope_type: 'company', scope_id: '', account_id: '', notes: '' });
    setPeriods(buildPeriods(currentYear, 'annual'));
    setError('');
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const handleFiscalOrTypeChange = (field: 'fiscal_year' | 'period_type', value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    setPeriods(buildPeriods(Number(next.fiscal_year) || currentYear, next.period_type));
  };

  const submit = () => {
    setError('');
    if (!form.name.trim()) return setError('Name is required');
    if (form.scope_type !== 'company' && !form.scope_id) return setError('Select a scope target');
    const parsedPeriods = periods.map((p) => ({ ...p, amount: parseFloat(p.amount) || 0 }));
    if (parsedPeriods.every((p) => p.amount === 0)) return setError('Enter at least one non-zero period amount');

    createMutation.mutate({
      name: form.name,
      fiscal_year: Number(form.fiscal_year),
      period_type: form.period_type,
      scope_type: form.scope_type,
      scope_id: form.scope_type === 'company' ? null : Number(form.scope_id),
      account_id: form.account_id ? Number(form.account_id) : null,
      notes: form.notes || null,
      periods: parsedPeriods,
    });
  };

  const scopeOptions = useMemo(() => {
    if (form.scope_type === 'cost_center') return costCenters.map((c: any) => ({ id: c.id, label: `${c.code} - ${c.name}` }));
    if (form.scope_type === 'project') return projects.map((p: any) => ({ id: p.id, label: p.name }));
    if (form.scope_type === 'employee') return employees.map((e: any) => ({ id: e.id, label: `${e.first_name} ${e.last_name}` }));
    return [];
  }, [form.scope_type, costCenters, projects, employees]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>Budgets</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openModal}>New Budget</Button>
        )}
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>FY</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell align="right">Total Budgeted</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : budgets.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No budgets yet</TableCell></TableRow>
              ) : budgets.map((b: any) => (
                <TableRow key={b.id} hover>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.fiscal_year}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{b.period_type}</TableCell>
                  <TableCell>
                    {b.scope_type === 'company' ? 'Company' : `${b.scope_type.replace('_', ' ')}: ${b.scope_label ?? '#' + b.scope_id}`}
                  </TableCell>
                  <TableCell align="right">${b.total_budgeted.toLocaleString()}</TableCell>
                  <TableCell><Chip size="small" label={b.status} color={STATUS_COLORS[b.status]} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.75 }}>
                    <Tooltip title="Actual vs Budget">
                      <IconButton size="small" onClick={() => setVarianceBudgetId(b.id)}><VarianceIcon fontSize="small" /></IconButton>
                    </Tooltip>
                    {isAdmin && b.status === 'draft' && (
                      <Tooltip title="Submit for approval">
                        <IconButton size="small" onClick={() => submitMutation.mutate(b.id)}><SendIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isAdmin && b.status === 'submitted' && (
                      <>
                        <Tooltip title="Approve">
                          <IconButton size="small" color="success" onClick={() => approveMutation.mutate(b.id)}><ApproveIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton size="small" color="error" onClick={() => setRejectTargetId(b.id)}><RejectIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </>
                    )}
                    {isAdmin && b.status !== 'approved' && (
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => deleteMutation.mutate(b.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create Budget Dialog */}
      <Dialog open={modalOpen} onClose={closeModal} maxWidth="md" fullWidth>
        <DialogTitle>New Budget</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth type="number" label="Fiscal Year" value={form.fiscal_year} onChange={(e) => handleFiscalOrTypeChange('fiscal_year', e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Period</InputLabel>
                <Select label="Period" value={form.period_type} onChange={(e) => handleFiscalOrTypeChange('period_type', e.target.value)}>
                  {PERIOD_TYPES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Scope</InputLabel>
                <Select label="Scope" value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value, scope_id: '' })}>
                  {SCOPE_TYPES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {form.scope_type !== 'company' && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Scope Target</InputLabel>
                  <Select label="Scope Target" value={form.scope_id} onChange={(e) => setForm({ ...form, scope_id: e.target.value })}>
                    {scopeOptions.map((o: any) => <MenuItem key={o.id} value={String(o.id)}>{o.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Account (optional)</InputLabel>
                <Select label="Account (optional)" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                  <MenuItem value="">Any / all accounts</MenuItem>
                  {accounts.map((a: any) => <MenuItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline minRows={2} label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Period Amounts</Typography>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow><TableCell>Period</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell><TableCell align="right">Amount</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {periods.map((p, idx) => (
                      <TableRow key={p.period_label}>
                        <TableCell>{p.period_label}</TableCell>
                        <TableCell>{p.period_start}</TableCell>
                        <TableCell>{p.period_end}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" type="number" value={p.amount}
                            onChange={(e) => {
                              const next = [...periods];
                              next[idx] = { ...next[idx], amount: e.target.value };
                              setPeriods(next);
                            }}
                            sx={{ width: 120 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectTargetId != null} onClose={() => setRejectTargetId(null)}>
        <DialogTitle>Reject Budget</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth multiline minRows={2} label="Reason (optional)" sx={{ mt: 1 }}
            value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTargetId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => rejectTargetId && rejectMutation.mutate({ id: rejectTargetId, remarks: rejectRemarks })}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Variance Dialog */}
      <Dialog open={varianceBudgetId != null} onClose={() => setVarianceBudgetId(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Actual vs Budget
          <IconButton onClick={() => setVarianceBudgetId(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {varianceLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
          ) : variance ? (
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{variance.name}</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {variance.scope_type === 'company' ? 'Company-wide' : `${variance.scope_type.replace('_', ' ')}: ${variance.scope_label ?? ''}`}
              </Typography>
              <Grid container spacing={2} sx={{ my: 1 }}>
                <Grid item xs={4}><Typography variant="caption" color="text.secondary">Budgeted</Typography><Typography variant="h6">${variance.total_budgeted.toLocaleString()}</Typography></Grid>
                <Grid item xs={4}><Typography variant="caption" color="text.secondary">Actual</Typography><Typography variant="h6">${variance.total_actual.toLocaleString()}</Typography></Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">Variance</Typography>
                  <Typography variant="h6" color={variance.total_variance < 0 ? 'error.main' : 'success.main'}>
                    ${variance.total_variance.toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell><TableCell align="right">Budgeted</TableCell>
                      <TableCell align="right">Actual</TableCell><TableCell align="right">Variance</TableCell>
                      <TableCell>Utilization</TableCell><TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {variance.periods.map((p: any) => (
                      <TableRow key={p.period_label}>
                        <TableCell>{p.period_label}</TableCell>
                        <TableCell align="right">${p.budgeted.toLocaleString()}</TableCell>
                        <TableCell align="right">${p.actual.toLocaleString()}</TableCell>
                        <TableCell align="right">${p.variance.toLocaleString()}</TableCell>
                        <TableCell sx={{ width: 140 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(p.utilization_pct ?? 0, 100)}
                            color={p.status === 'over' ? 'error' : p.status === 'on_track' ? 'warning' : 'success'}
                          />
                        </TableCell>
                        <TableCell><Chip size="small" label={p.status.replace('_', ' ')} color={p.status === 'over' ? 'error' : p.status === 'on_track' ? 'warning' : 'success'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Budgets;
