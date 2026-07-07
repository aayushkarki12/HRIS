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
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  CheckCircle as ProcessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { payrollService, employeeService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Payroll: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);

  // Salary Structure Dialog
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ employee_id: '', base_salary: '', effective_date: new Date().toISOString().split('T')[0] });
  const [salaryError, setSalaryError] = useState('');

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

  const createSalaryMutation = useMutation({
    mutationFn: (data: any) => payrollService.createSalaryStructure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
      toast.success('Salary structure created');
      setSalaryModalOpen(false);
      setSalaryForm({ employee_id: '', base_salary: '', effective_date: new Date().toISOString().split('T')[0] });
      setSalaryError('');
    },
    onError: (error: any) => {
      const msg = getErrorMessage(error, 'Failed to create salary structure');
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
          { label: 'My Salary', value: salaryStructures?.find((s: any) => s.is_active) ? `$${salaryStructures.find((s: any) => s.is_active).base_salary.toLocaleString()}` : 'Not Set', color: '#667eea' },
          { label: 'My Payslips', value: myPayslips?.length || 0, color: '#2ecc71' },
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
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSalaryModalOpen(true)}>
                Add Salary
              </Button>
            </Box>
          )}

          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell align="right"><strong>Base Salary</strong></TableCell>
                  <TableCell><strong>Currency</strong></TableCell>
                  <TableCell><strong>Effective Date</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(!salaryStructures || salaryStructures.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">No salary structures defined</Typography>
                    </TableCell>
                  </TableRow>
                ) : salaryStructures.map((salary: any) => (
                  <TableRow key={salary.id} hover>
                    <TableCell>{getEmployeeName(salary.employee_id)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(salary.base_salary)}</TableCell>
                    <TableCell>{salary.currency}</TableCell>
                    <TableCell>{new Date(salary.effective_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip label={salary.is_active ? 'Active' : 'Inactive'} color={salary.is_active ? 'success' : 'default'} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Salary Structure Dialog */}
      <Dialog open={salaryModalOpen} onClose={() => setSalaryModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Salary Structure</DialogTitle>
        <DialogContent>
          {salaryError && <Alert severity="error" sx={{ mb: 2 }}>{salaryError}</Alert>}
          <TextField
            fullWidth select label="Employee" name="employee_id"
            value={salaryForm.employee_id}
            onChange={(e) => setSalaryForm({ ...salaryForm, employee_id: e.target.value })}
            margin="normal" size="small"
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
            fullWidth label="Effective Date" name="effective_date" type="date"
            value={salaryForm.effective_date}
            onChange={(e) => setSalaryForm({ ...salaryForm, effective_date: e.target.value })}
            margin="normal" size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSalaryModalOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!salaryForm.employee_id || !salaryForm.base_salary || createSalaryMutation.isPending}
            onClick={() => createSalaryMutation.mutate({
              employee_id: Number(salaryForm.employee_id),
              base_salary: Number(salaryForm.base_salary),
              effective_date: salaryForm.effective_date,
            })}
          >
            {createSalaryMutation.isPending ? 'Creating...' : 'Create'}
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
