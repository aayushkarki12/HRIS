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
  CircularProgress,
  Alert,
  MenuItem,
  IconButton,
  Collapse,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  CheckCircle as ProcessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { payrollService, employeeService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Pre-filled when setting up a new salary - a placeholder the admin should
// verify/adjust against current SSF rules, not an asserted-correct rate.
// Mirrors HRIS_backend app/schemas/payroll.py::DEFAULT_SSF_PERCENT.
const DEFAULT_SSF_PERCENT = '10';

const emptySalaryForm = {
  employee_id: '',
  base_salary: '',
  bonus: '0',
  ssf_percent: DEFAULT_SSF_PERCENT,
  other_deductions: '0',
  effective_date: new Date().toISOString().split('T')[0],
};

const Payroll: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);

  // Salary Structure Dialog (create or edit)
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [editingSalaryId, setEditingSalaryId] = useState<number | null>(null);
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);
  const [salaryError, setSalaryError] = useState('');

  // Live preview of SSF amount / total deductions / net pay as the admin types,
  // using the same formula the backend computes on the response.
  const salaryPreview = useMemo(() => {
    const base = Number(salaryForm.base_salary) || 0;
    const bonus = Number(salaryForm.bonus) || 0;
    const ssfPercent = Number(salaryForm.ssf_percent) || 0;
    const otherDeductions = Number(salaryForm.other_deductions) || 0;
    const ssfAmount = Math.round(base * (ssfPercent / 100) * 100) / 100;
    const totalDeductions = Math.round((ssfAmount + otherDeductions) * 100) / 100;
    const netPay = Math.round((base + bonus - totalDeductions) * 100) / 100;
    return { ssfAmount, totalDeductions, netPay };
  }, [salaryForm]);

  // Payroll Run Dialog
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runForm, setRunForm] = useState({ period_start: '', period_end: '' });
  const [runError, setRunError] = useState('');

  const { data: salaryStructures, isLoading: salaryLoading, refetch: refetchSalaries } = useQuery({
    queryKey: ['salaryStructures'],
    queryFn: () => payrollService.getSalaryStructures(),
  });

  const { data: payrollRuns, isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['payrollRuns'],
    queryFn: payrollService.getPayrollRuns,
    enabled: isAdmin,
  });

  const { data: myPayslips, isLoading: myPayslipsLoading, refetch: refetchMyPayslips } = useQuery({
    queryKey: ['myPayslips'],
    queryFn: payrollService.getMyPayslips,
    enabled: !isAdmin,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
  });

  const closeSalaryModal = () => {
    setSalaryModalOpen(false);
    setEditingSalaryId(null);
    setSalaryForm(emptySalaryForm);
    setSalaryError('');
  };

  const createSalaryMutation = useMutation({
    mutationFn: (data: any) => payrollService.createSalaryStructure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
      toast.success('Salary structure created');
      closeSalaryModal();
    },
    onError: (error: any) => {
      const msg = getErrorMessage(error, 'Failed to create salary structure');
      toast.error(msg);
      setSalaryError(msg);
    },
  });

  const updateSalaryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => payrollService.updateSalaryStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
      toast.success('Salary structure updated');
      closeSalaryModal();
    },
    onError: (error: any) => {
      const msg = getErrorMessage(error, 'Failed to update salary structure');
      toast.error(msg);
      setSalaryError(msg);
    },
  });

  const createRunMutation = useMutation({
    mutationFn: (data: any) => payrollService.createPayrollRun(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      toast.success('Payroll run created with payslips');
      setRunModalOpen(false);
      setRunForm({ period_start: '', period_end: '' });
      setRunError('');
    },
    onError: (error: any) => {
      const msg = getErrorMessage(error, 'Failed to create payroll run');
      toast.error(msg);
      setRunError(msg);
    },
  });

  const processMutation = useMutation({
    mutationFn: (id: number) => payrollService.processPayrollRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      toast.success('Payroll processed and journal entry created');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to process payroll'));
    },
  });

  const deleteRunMutation = useMutation({
    mutationFn: (id: number) => payrollService.deletePayrollRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      toast.success('Payroll run deleted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete payroll run'));
    },
  });

  const getEmployeeName = (employeeId: number) => {
    const emp = employees?.find((e: any) => e.id === employeeId);
    return emp ? `${emp.first_name} ${emp.last_name}` : `Employee #${employeeId}`;
  };

  const getStatusColor = (status: string): 'warning' | 'success' | 'info' | 'default' => {
    switch (status) {
      case 'draft': return 'warning';
      case 'processed': return 'success';
      case 'paid': return 'info';
      default: return 'default';
    }
  };

  if (salaryLoading || runsLoading || myPayslipsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
            Payroll
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage salaries, run payroll, and generate payslips
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { refetchSalaries(); if (isAdmin) refetchRuns(); else refetchMyPayslips(); }}>
          Refresh
        </Button>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {(isAdmin ? [
          { label: 'Salary Structures', value: salaryStructures?.filter((s: any) => s.is_active).length || 0, color: '#667eea' },
          { label: 'Payroll Runs', value: payrollRuns?.length || 0, color: '#f39c12' },
          { label: 'Draft', value: payrollRuns?.filter((r: any) => r.status === 'draft').length || 0, color: '#e74c3c' },
          { label: 'Processed', value: payrollRuns?.filter((r: any) => r.status === 'processed').length || 0, color: '#2ecc71' },
        ] : [
          { label: 'My Base Salary', value: salaryStructures?.find((s: any) => s.is_active) ? fmt(salaryStructures.find((s: any) => s.is_active).base_salary) : 'Not Set', color: '#667eea' },
          { label: 'My Net Pay', value: salaryStructures?.find((s: any) => s.is_active) ? fmt(salaryStructures.find((s: any) => s.is_active).net_pay ?? 0) : 'Not Set', color: '#2ecc71' },
          { label: 'My Payslips', value: myPayslips?.length || 0, color: '#f39c12' },
        ]).map((stat: any) => (
          <Paper key={stat.label} sx={{ p: 2, flex: { xs: '1 1 100%', sm: '1 1 calc(25% - 12px)' }, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>{stat.label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label={isAdmin ? "Payroll Runs" : "My Payslips"} />
          <Tab label={isAdmin ? "Salary Structures" : "My Salary"} />
        </Tabs>
      </Paper>

      {/* Tab 0: Payroll Runs (admin) / My Payslips (employee) */}
      {tab === 0 && !isAdmin && (
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Base</strong></TableCell>
                <TableCell align="right"><strong>Gross</strong></TableCell>
                <TableCell align="right"><strong>Deductions</strong></TableCell>
                <TableCell align="right"><strong>Net</strong></TableCell>
                <TableCell align="right"><strong>Work Days</strong></TableCell>
                <TableCell align="right"><strong>Leave Days</strong></TableCell>
                <TableCell><strong>Created</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(!myPayslips || myPayslips.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">No payslips yet</Typography>
                  </TableCell>
                </TableRow>
              ) : myPayslips.map((slip: any) => (
                <TableRow key={slip.id} hover>
                  <TableCell>{fmt(slip.base_salary)}</TableCell>
                  <TableCell align="right">{fmt(slip.gross_salary)}</TableCell>
                  <TableCell align="right" sx={{ color: '#e74c3c' }}>{fmt(slip.total_deductions)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(slip.net_salary)}</TableCell>
                  <TableCell align="right">{slip.working_days}</TableCell>
                  <TableCell align="right">{slip.leave_days}</TableCell>
                  <TableCell>{new Date(slip.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 0 && isAdmin && (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRunModalOpen(true)}>
              Run Payroll
            </Button>
          </Box>

          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell width={40}></TableCell>
                  <TableCell><strong>Period</strong></TableCell>
                  <TableCell align="right"><strong>Gross</strong></TableCell>
                  <TableCell align="right"><strong>Deductions</strong></TableCell>
                  <TableCell align="right"><strong>Net</strong></TableCell>
                  <TableCell><strong>Payslips</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {(!payrollRuns || payrollRuns.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">No payroll runs yet</Typography>
                    </TableCell>
                  </TableRow>
                ) : payrollRuns.map((run: any) => {
                  const isExpanded = expandedRun === run.id;
                  return (
                    <React.Fragment key={run.id}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton size="small" onClick={() => setExpandedRun(isExpanded ? null : run.id)}>
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {new Date(run.period_start).toLocaleDateString()} — {new Date(run.period_end).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{fmt(run.total_gross)}</TableCell>
                        <TableCell align="right" sx={{ color: '#e74c3c' }}>{fmt(run.total_deductions)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(run.total_net)}</TableCell>
                        <TableCell>
                          <Chip label={`${run.payslips?.length || 0} payslips`} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip label={run.status} color={getStatusColor(run.status)} size="small" sx={{ textTransform: 'capitalize' }} />
                        </TableCell>
                        {isAdmin && (
                          <TableCell align="right">
                            {run.status === 'draft' && (
                              <>
                                <IconButton size="small" color="success" onClick={() => {
                                  if (window.confirm('Process payroll and create journal entry?')) processMutation.mutate(run.id);
                                }} title="Process">
                                  <ProcessIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => {
                                  if (window.confirm('Delete this draft payroll run?')) deleteRunMutation.mutate(run.id);
                                }} title="Delete">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 8 : 7} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Payslips</Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell><strong>Employee</strong></TableCell>
                                    <TableCell align="right"><strong>Base</strong></TableCell>
                                    <TableCell align="right"><strong>Gross</strong></TableCell>
                                    <TableCell align="right"><strong>Deductions</strong></TableCell>
                                    <TableCell align="right"><strong>Net</strong></TableCell>
                                    <TableCell align="right"><strong>Work Days</strong></TableCell>
                                    <TableCell align="right"><strong>Leave Days</strong></TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {run.payslips?.map((slip: any) => (
                                    <TableRow key={slip.id} hover>
                                      <TableCell>{getEmployeeName(slip.employee_id)}</TableCell>
                                      <TableCell align="right">{fmt(slip.base_salary)}</TableCell>
                                      <TableCell align="right">{fmt(slip.gross_salary)}</TableCell>
                                      <TableCell align="right" sx={{ color: '#e74c3c' }}>{fmt(slip.total_deductions)}</TableCell>
                                      <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(slip.net_salary)}</TableCell>
                                      <TableCell align="right">{slip.working_days}</TableCell>
                                      <TableCell align="right">{slip.leave_days}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
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
        </>
      )}

      {/* Tab 1: Salary Structures */}
      {tab === 1 && (
        <>
          {isAdmin && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setSalaryForm(emptySalaryForm); setEditingSalaryId(null); setSalaryModalOpen(true); }}>
                Add Salary
              </Button>
            </Box>
          )}

          {!isAdmin && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This is your salary breakdown: base pay plus any bonus, minus SSF and other deductions, equals your net pay ("total in hand").
            </Alert>
          )}

          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell align="right"><strong>Base Salary</strong></TableCell>
                  <TableCell align="right"><strong>Bonus</strong></TableCell>
                  <TableCell align="right"><strong>SSF Deduction</strong></TableCell>
                  <TableCell align="right"><strong>Other Deductions</strong></TableCell>
                  <TableCell align="right"><strong>Net Pay (Total in Hand)</strong></TableCell>
                  <TableCell><strong>Effective Date</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {(!salaryStructures || salaryStructures.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">No salary structures defined</Typography>
                    </TableCell>
                  </TableRow>
                ) : salaryStructures.map((salary: any) => (
                  <TableRow key={salary.id} hover>
                    <TableCell>{getEmployeeName(salary.employee_id)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(salary.base_salary)}</TableCell>
                    <TableCell align="right">{fmt(salary.bonus ?? 0)}</TableCell>
                    <TableCell align="right" sx={{ color: '#e74c3c' }}>
                      {fmt(salary.ssf_amount ?? 0)}
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        ({salary.ssf_percent ?? 0}%)
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#e74c3c' }}>{fmt(salary.other_deductions ?? 0)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#2ecc71' }}>{fmt(salary.net_pay ?? 0)}</TableCell>
                    <TableCell>{new Date(salary.effective_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip label={salary.is_active ? 'Active' : 'Inactive'} color={salary.is_active ? 'success' : 'default'} size="small" />
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingSalaryId(salary.id);
                            setSalaryForm({
                              employee_id: String(salary.employee_id),
                              base_salary: String(salary.base_salary),
                              bonus: String(salary.bonus ?? 0),
                              ssf_percent: String(salary.ssf_percent ?? DEFAULT_SSF_PERCENT),
                              other_deductions: String(salary.other_deductions ?? 0),
                              effective_date: salary.effective_date,
                            });
                            setSalaryError('');
                            setSalaryModalOpen(true);
                          }}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Salary Structure Dialog (create or edit) */}
      <Dialog open={salaryModalOpen} onClose={closeSalaryModal} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSalaryId ? 'Edit Salary Structure' : 'Add Salary Structure'}</DialogTitle>
        <DialogContent>
          {salaryError && <Alert severity="error" sx={{ mb: 2 }}>{salaryError}</Alert>}
          <TextField
            fullWidth select label="Employee" name="employee_id"
            value={salaryForm.employee_id}
            onChange={(e) => setSalaryForm({ ...salaryForm, employee_id: e.target.value })}
            margin="normal" size="small"
            disabled={!!editingSalaryId}
          >
            <MenuItem value="">Select Employee</MenuItem>
            {employees?.filter((e: any) => e.is_active).map((emp: any) => (
              <MenuItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_id})</MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth label="Base Monthly Salary" name="base_salary" type="number"
            value={salaryForm.base_salary}
            onChange={(e) => setSalaryForm({ ...salaryForm, base_salary: e.target.value })}
            margin="normal" size="small"
            slotProps={{ htmlInput: { min: 0, step: 100 } }}
          />
          <TextField
            fullWidth label="Bonus" name="bonus" type="number"
            value={salaryForm.bonus}
            onChange={(e) => setSalaryForm({ ...salaryForm, bonus: e.target.value })}
            margin="normal" size="small"
            helperText="One-off or recurring bonus, added on top of base salary"
            slotProps={{ htmlInput: { min: 0, step: 100 } }}
          />
          <TextField
            fullWidth label="SSF Deduction %" name="ssf_percent" type="number"
            value={salaryForm.ssf_percent}
            onChange={(e) => setSalaryForm({ ...salaryForm, ssf_percent: e.target.value })}
            margin="normal" size="small"
            helperText={`Social Security Fund contribution, as % of base salary. Default (${DEFAULT_SSF_PERCENT}%) is a placeholder - verify/adjust against current SSF rules before relying on it.`}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 } }}
          />
          <TextField
            fullWidth label="Other Deductions" name="other_deductions" type="number"
            value={salaryForm.other_deductions}
            onChange={(e) => setSalaryForm({ ...salaryForm, other_deductions: e.target.value })}
            margin="normal" size="small"
            helperText="Any other flat deduction - loan repayment, advance, etc."
            slotProps={{ htmlInput: { min: 0, step: 100 } }}
          />
          <TextField
            fullWidth label="Effective Date" name="effective_date" type="date"
            value={salaryForm.effective_date}
            onChange={(e) => setSalaryForm({ ...salaryForm, effective_date: e.target.value })}
            margin="normal" size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />

          {salaryForm.base_salary && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="body2">SSF Deduction: {fmt(salaryPreview.ssfAmount)}</Typography>
              <Typography variant="body2">Total Deductions: {fmt(salaryPreview.totalDeductions)}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Net Pay (Total in Hand): {fmt(salaryPreview.netPay)}</Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSalaryModal}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!salaryForm.employee_id || !salaryForm.base_salary || createSalaryMutation.isPending || updateSalaryMutation.isPending}
            onClick={() => {
              const payload = {
                employee_id: Number(salaryForm.employee_id),
                base_salary: Number(salaryForm.base_salary),
                bonus: Number(salaryForm.bonus) || 0,
                ssf_percent: Number(salaryForm.ssf_percent) || 0,
                other_deductions: Number(salaryForm.other_deductions) || 0,
                effective_date: salaryForm.effective_date,
              };
              if (editingSalaryId) {
                const { employee_id, ...updateData } = payload;
                updateSalaryMutation.mutate({ id: editingSalaryId, data: updateData });
              } else {
                createSalaryMutation.mutate(payload);
              }
            }}
          >
            {createSalaryMutation.isPending || updateSalaryMutation.isPending
              ? 'Saving...'
              : editingSalaryId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payroll Run Dialog */}
      <Dialog open={runModalOpen} onClose={() => setRunModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Run Payroll</DialogTitle>
        <DialogContent>
          {runError && <Alert severity="error" sx={{ mb: 2 }}>{runError}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            This will generate payslips for all active employees with salary structures.
            Leave days and attendance will be factored into the calculation.
          </Alert>
          <TextField
            fullWidth label="Period Start" name="period_start" type="date"
            value={runForm.period_start}
            onChange={(e) => setRunForm({ ...runForm, period_start: e.target.value })}
            margin="normal" size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth label="Period End" name="period_end" type="date"
            value={runForm.period_end}
            onChange={(e) => setRunForm({ ...runForm, period_end: e.target.value })}
            margin="normal" size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunModalOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!runForm.period_start || !runForm.period_end || createRunMutation.isPending}
            onClick={() => createRunMutation.mutate(runForm)}
          >
            {createRunMutation.isPending ? 'Generating...' : 'Generate Payslips'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Payroll;
