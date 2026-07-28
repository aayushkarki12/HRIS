import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Chip,
  Avatar,
  Alert,
  Divider,
  IconButton,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ContentCopy as CopyIcon,
  PersonOff as PersonOffIcon,
  CheckCircle as ActivateIcon,
  MailOutlined as InviteIcon,
  DeleteForever as DeleteForeverIcon,
  WorkHistory as JoinedIcon,
  TrendingUp as PromotionIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { employeeService, rbacService, payrollService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const NEW_DESIGNATION_SENTINEL = '__new__';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Mirrors HRIS_backend app/schemas/payroll.py::DEFAULT_SSF_PERCENT - a
// placeholder the admin should verify/adjust, not an asserted-correct rate.
const DEFAULT_SSF_PERCENT = '10';

const today = () => new Date().toISOString().split('T')[0];

const SectionPaper: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', mb: 2.5 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
    {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>}
    {!subtitle && <Box sx={{ mb: 2 }} />}
    {children}
  </Paper>
);

const EmployeeDetail: React.FC = () => {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const invalidateEmployee = () => {
    queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employee-history', employeeId] });
  };

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeeService.getById(employeeId),
    enabled: !!employeeId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['rbac-departments'],
    queryFn: () => rbacService.getDepartments(),
  });

  const { data: roles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => rbacService.getRoles(),
  });

  const { data: seniorityLevels = [] } = useQuery({
    queryKey: ['rbac-seniority-levels'],
    queryFn: () => rbacService.getSeniorityLevels(),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['employee-history', employeeId],
    queryFn: () => employeeService.getHistory(employeeId),
    enabled: !!employeeId,
  });

  const { data: salaryStructures = [], isLoading: salaryLoading } = useQuery({
    queryKey: ['salaryStructures', employeeId],
    queryFn: () => payrollService.getSalaryStructures(employeeId),
    enabled: !!employeeId,
  });
  const activeSalary = useMemo(
    () => (salaryStructures as any[]).find((s) => s.is_active) ?? null,
    [salaryStructures],
  );

  // ============ Basic info ============
  const [basicForm, setBasicForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', department: '', position: '', joining_date: '',
  });
  const [creatingDesignation, setCreatingDesignation] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');

  useEffect(() => {
    if (employee) {
      setBasicForm({
        first_name: employee.first_name ?? '',
        last_name: employee.last_name ?? '',
        email: employee.email ?? '',
        phone: employee.phone ?? '',
        department: employee.department ?? '',
        position: employee.position ?? '',
        joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : '',
      });
    }
  }, [employee]);

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => rbacService.createRole({ name, permission_keys: [] }),
    onSuccess: async (newRole: any) => {
      await refetchRoles();
      setBasicForm((f) => ({ ...f, position: newRole.name }));
      setCreatingDesignation(false);
      setNewDesignationName('');
      toast.success(`"${newRole.name}" created`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create designation')),
  });

  const updateBasicMutation = useMutation({
    mutationFn: (data: any) => employeeService.update(employeeId, data),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Basic info updated');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update employee')),
  });

  // ============ Employment & promotion ============
  const [employmentForm, setEmploymentForm] = useState({
    seniority_level_id: '' as string | number,
    employment_type: 'full_time' as 'full_time' | 'probation',
    effective_date: today(),
  });

  useEffect(() => {
    if (employee) {
      setEmploymentForm((f) => ({
        ...f,
        seniority_level_id: employee.seniority_level_id ?? '',
        employment_type: employee.employment_type === 'probation' ? 'probation' : 'full_time',
      }));
    }
  }, [employee]);

  const updateEmploymentMutation = useMutation({
    mutationFn: (data: any) => employeeService.update(employeeId, data),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Employment details saved - the change is recorded on their career history at the effective date given');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update employment details')),
  });

  // ============ Compensation ============
  const emptySalaryForm = {
    base_salary: '', bonus: '0', ssf_percent: DEFAULT_SSF_PERCENT, other_deductions: '0',
    effective_date: today(),
  };
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);
  const [settingUpSalary, setSettingUpSalary] = useState(false);

  useEffect(() => {
    if (activeSalary) {
      setSalaryForm({
        base_salary: String(activeSalary.base_salary),
        bonus: String(activeSalary.bonus ?? 0),
        ssf_percent: String(activeSalary.ssf_percent ?? DEFAULT_SSF_PERCENT),
        other_deductions: String(activeSalary.other_deductions ?? 0),
        effective_date: activeSalary.effective_date,
      });
    }
  }, [activeSalary]);

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

  const createSalaryMutation = useMutation({
    mutationFn: (data: any) => payrollService.createSalaryStructure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaryStructures', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
      toast.success('Salary structure created');
      setSettingUpSalary(false);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to set salary')),
  });

  const updateSalaryMutation = useMutation({
    mutationFn: (data: any) => payrollService.updateSalaryStructure(activeSalary.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaryStructures', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['salaryStructures'] });
      toast.success('Salary structure updated');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update salary')),
  });

  // ============ Admin actions ============
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [permanentDeleteConfirmOpen, setPermanentDeleteConfirmOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const deactivateMutation = useMutation({
    mutationFn: () => employeeService.delete(employeeId),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Employee deactivated');
      setDeactivateConfirmOpen(false);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to deactivate employee')),
  });

  const activateMutation = useMutation({
    mutationFn: () => employeeService.activate(employeeId),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Employee reactivated - their login works again');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to reactivate employee')),
  });

  const resendInviteMutation = useMutation({
    mutationFn: () => employeeService.resendInvite(employeeId),
    onSuccess: (result: any) => {
      invalidateEmployee();
      setInviteLink(result.invite_link);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to resend invite')),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => employeeService.permanentDelete(employeeId),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(result?.message ?? 'Employee permanently deleted');
      navigate('/employees');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to permanently delete employee'));
      setPermanentDeleteConfirmOpen(false);
    },
  });

  if (!isAdmin) return null; // route is already gated by RequireRole; belt and suspenders

  if (isLoading || !employee) {
    return (
      <Box>
        <Skeleton width={120} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={220} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/employees')} size="small" sx={{ mb: 2 }} color="inherit">
          Back to Employees
        </Button>

        {/* Header */}
        <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 56, height: 56, fontSize: '1.25rem', fontWeight: 600, bgcolor: 'primary.main' }}>
              {employee.first_name?.[0]}{employee.last_name?.[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                {employee.first_name} {employee.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <span style={{ fontFamily: 'monospace' }}>{employee.employee_id}</span>
                {' · '}{employee.department}{' · '}{employee.position}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={employee.is_active ? 'Active' : 'Inactive'} color={employee.is_active ? 'success' : 'default'} sx={{ fontWeight: 500 }} />
              {employee.invite_status === 'invited' && <Chip label="Invited" color="warning" variant="outlined" />}
              {employee.invite_status === 'expired' && <Chip label="Expired" color="error" variant="outlined" />}
              {employee.invite_status === 'accepted' && <Chip label="Accepted" color="success" variant="outlined" />}
            </Box>
          </Box>
        </Paper>

        {/* Basic info */}
        <SectionPaper title="Basic Info">
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField
              fullWidth size="small" label="First Name"
              value={basicForm.first_name}
              onChange={(e) => setBasicForm({ ...basicForm, first_name: e.target.value })}
            />
            <TextField
              fullWidth size="small" label="Last Name"
              value={basicForm.last_name}
              onChange={(e) => setBasicForm({ ...basicForm, last_name: e.target.value })}
            />
            <TextField
              fullWidth size="small" label="Email" type="email" sx={{ gridColumn: '1 / -1' }}
              value={basicForm.email}
              onChange={(e) => setBasicForm({ ...basicForm, email: e.target.value })}
            />
            <TextField
              fullWidth size="small" label="Phone" sx={{ gridColumn: '1 / -1' }}
              value={basicForm.phone}
              onChange={(e) => setBasicForm({ ...basicForm, phone: e.target.value })}
            />
            <TextField
              fullWidth select size="small" label="Department"
              value={basicForm.department}
              onChange={(e) => setBasicForm({ ...basicForm, department: e.target.value })}
            >
              {basicForm.department && !(departments as any[]).some((d) => d.name === basicForm.department) && (
                <MenuItem value={basicForm.department}>{basicForm.department} (not in list)</MenuItem>
              )}
              {(departments as any[]).map((d) => (
                <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth size="small" label="Join Date" type="date"
              value={basicForm.joining_date}
              onChange={(e) => setBasicForm({ ...basicForm, joining_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {creatingDesignation ? (
              <Box sx={{ display: 'flex', gap: 1, gridColumn: '1 / -1' }}>
                <TextField
                  fullWidth autoFocus size="small" label="New Position / Designation"
                  value={newDesignationName}
                  onChange={(e) => setNewDesignationName(e.target.value)}
                  placeholder="e.g. Senior Developer"
                />
                <Button
                  variant="contained" size="small"
                  disabled={!newDesignationName.trim() || createRoleMutation.isPending}
                  onClick={() => createRoleMutation.mutate(newDesignationName.trim())}
                >
                  Add
                </Button>
                <Button size="small" color="inherit" onClick={() => { setCreatingDesignation(false); setNewDesignationName(''); }}>
                  Cancel
                </Button>
              </Box>
            ) : (
              <TextField
                fullWidth select size="small" label="Position / Designation" sx={{ gridColumn: '1 / -1' }}
                value={basicForm.position}
                onChange={(e) => {
                  if (e.target.value === NEW_DESIGNATION_SENTINEL) {
                    setCreatingDesignation(true);
                    return;
                  }
                  setBasicForm({ ...basicForm, position: e.target.value });
                }}
                helperText="Updates their job title. To change what permissions their login has, use Users & Roles."
              >
                {basicForm.position && !(roles as any[]).some((r) => r.name === basicForm.position) && (
                  <MenuItem value={basicForm.position}>{basicForm.position} (not in list)</MenuItem>
                )}
                {(roles as any[]).map((r) => (
                  <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
                ))}
                <MenuItem value={NEW_DESIGNATION_SENTINEL} sx={{ fontStyle: 'italic' }}>+ Create New…</MenuItem>
              </TextField>
            )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              disabled={updateBasicMutation.isPending}
              onClick={() => updateBasicMutation.mutate(basicForm)}
            >
              {updateBasicMutation.isPending ? 'Saving…' : 'Save Basic Info'}
            </Button>
          </Box>
        </SectionPaper>

        {/* Employment & promotion */}
        <SectionPaper
          title="Employment & Promotion"
          subtitle="Recording a change here also adds an entry to Career History below, timestamped at the Effective Date - this is how a promotion is done."
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField
              fullWidth select size="small" label="Seniority Level"
              value={employmentForm.seniority_level_id === null ? '' : String(employmentForm.seniority_level_id)}
              onChange={(e) => setEmploymentForm({ ...employmentForm, seniority_level_id: e.target.value })}
              helperText="Affects approval limits, e.g. how large an invoice a Senior Accountant can approve"
            >
              <MenuItem value="">None</MenuItem>
              {(seniorityLevels as any[]).map((level) => (
                <MenuItem key={level.id} value={String(level.id)}>{level.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth select size="small" label="Employment Status"
              value={employmentForm.employment_type}
              onChange={(e) => setEmploymentForm({ ...employmentForm, employment_type: e.target.value as 'full_time' | 'probation' })}
              helperText="Probation employees get a reduced leave allocation until confirmed"
            >
              <MenuItem value="full_time">Full-time</MenuItem>
              <MenuItem value="probation">Probation</MenuItem>
            </TextField>
            <TextField
              fullWidth size="small" label="Effective Date" type="date" sx={{ gridColumn: '1 / -1' }}
              value={employmentForm.effective_date}
              onChange={(e) => setEmploymentForm({ ...employmentForm, effective_date: e.target.value })}
              helperText="When this change takes effect - controls where it lands on the career history timeline, not just when it's saved"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              disabled={updateEmploymentMutation.isPending}
              onClick={() => updateEmploymentMutation.mutate({
                seniority_level_id: employmentForm.seniority_level_id === '' ? null : Number(employmentForm.seniority_level_id),
                employment_type: employmentForm.employment_type,
                effective_date: employmentForm.effective_date,
              })}
            >
              {updateEmploymentMutation.isPending ? 'Saving…' : 'Save / Promote'}
            </Button>
          </Box>
        </SectionPaper>

        {/* Compensation */}
        <SectionPaper title="Compensation">
          {salaryLoading ? (
            <Skeleton variant="rectangular" height={80} />
          ) : !activeSalary && !settingUpSalary ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No salary set</Typography>
              <Button variant="contained" size="small" onClick={() => setSettingUpSalary(true)}>Set Salary</Button>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField
                  fullWidth size="small" label="Base Monthly Salary" type="number"
                  value={salaryForm.base_salary}
                  onChange={(e) => setSalaryForm({ ...salaryForm, base_salary: e.target.value })}
                  slotProps={{ htmlInput: { min: 0, step: 100 } }}
                />
                <TextField
                  fullWidth size="small" label="Bonus" type="number"
                  value={salaryForm.bonus}
                  onChange={(e) => setSalaryForm({ ...salaryForm, bonus: e.target.value })}
                  helperText="One-off or recurring bonus, added on top of base salary"
                  slotProps={{ htmlInput: { min: 0, step: 100 } }}
                />
                <TextField
                  fullWidth size="small" label="SSF Deduction %" type="number"
                  value={salaryForm.ssf_percent}
                  onChange={(e) => setSalaryForm({ ...salaryForm, ssf_percent: e.target.value })}
                  helperText={`Placeholder default (${DEFAULT_SSF_PERCENT}%) - verify/adjust against current SSF rules.`}
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 } }}
                />
                <TextField
                  fullWidth size="small" label="Other Deductions" type="number"
                  value={salaryForm.other_deductions}
                  onChange={(e) => setSalaryForm({ ...salaryForm, other_deductions: e.target.value })}
                  helperText="Any other flat deduction - loan repayment, advance, etc."
                  slotProps={{ htmlInput: { min: 0, step: 100 } }}
                />
                <TextField
                  fullWidth size="small" label="Effective Date" type="date" sx={{ gridColumn: '1 / -1' }}
                  value={salaryForm.effective_date}
                  onChange={(e) => setSalaryForm({ ...salaryForm, effective_date: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>

              {salaryForm.base_salary && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">SSF Deduction: {fmt(salaryPreview.ssfAmount)}</Typography>
                  <Typography variant="body2">Total Deductions: {fmt(salaryPreview.totalDeductions)}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Net Pay (Total in Hand): {fmt(salaryPreview.netPay)}</Typography>
                </Alert>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                {settingUpSalary && !activeSalary && (
                  <Button color="inherit" onClick={() => { setSettingUpSalary(false); setSalaryForm(emptySalaryForm); }}>Cancel</Button>
                )}
                <Button
                  variant="contained"
                  disabled={!salaryForm.base_salary || createSalaryMutation.isPending || updateSalaryMutation.isPending}
                  onClick={() => {
                    const payload = {
                      base_salary: Number(salaryForm.base_salary),
                      bonus: Number(salaryForm.bonus) || 0,
                      ssf_percent: Number(salaryForm.ssf_percent) || 0,
                      other_deductions: Number(salaryForm.other_deductions) || 0,
                      effective_date: salaryForm.effective_date,
                    };
                    if (activeSalary) {
                      updateSalaryMutation.mutate(payload);
                    } else {
                      createSalaryMutation.mutate({ ...payload, employee_id: employeeId });
                    }
                  }}
                >
                  {createSalaryMutation.isPending || updateSalaryMutation.isPending
                    ? 'Saving…'
                    : activeSalary ? 'Update Salary' : 'Create Salary'}
                </Button>
              </Box>
            </>
          )}
        </SectionPaper>

        {/* Career history */}
        <SectionPaper title="Career History">
          {historyLoading ? (
            <Skeleton variant="rectangular" height={120} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[...history].reverse().map((entry, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1.5, position: 'relative', pb: i === history.length - 1 ? 0 : 3 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: entry.action === 'joined' ? '#EEF2FF' : '#F0FDF4', flexShrink: 0,
                    }}>
                      {entry.action === 'joined'
                        ? <JoinedIcon sx={{ fontSize: 16, color: '#4F46E5' }} />
                        : <PromotionIcon sx={{ fontSize: 16, color: '#16A34A' }} />}
                    </Box>
                    {i !== history.length - 1 && <Box sx={{ width: '2px', flex: 1, bgcolor: 'divider', my: 0.5 }} />}
                  </Box>
                  <Box sx={{ pb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.details}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </Typography>
                  </Box>
                </Box>
              ))}
              {history.length === 0 && (
                <Typography variant="body2" color="text.secondary">No history recorded yet.</Typography>
              )}
            </Box>
          )}
        </SectionPaper>

        {/* Danger zone / admin actions */}
        <SectionPaper title="Danger Zone">
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(employee.invite_status === 'invited' || employee.invite_status === 'expired') && (
              <Tooltip title="Copy a fresh invite link">
                <Button
                  variant="outlined" color="info" size="small" startIcon={<InviteIcon />}
                  disabled={resendInviteMutation.isPending}
                  onClick={() => resendInviteMutation.mutate()}
                >
                  Resend Invite
                </Button>
              </Tooltip>
            )}
            {employee.is_active ? (
              <Button
                variant="outlined" color="error" size="small" startIcon={<PersonOffIcon />}
                onClick={() => setDeactivateConfirmOpen(true)}
              >
                Deactivate
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined" color="success" size="small" startIcon={<ActivateIcon />}
                  disabled={activateMutation.isPending}
                  onClick={() => activateMutation.mutate()}
                >
                  Reactivate
                </Button>
                <Button
                  variant="outlined" color="error" size="small" startIcon={<DeleteForeverIcon />}
                  onClick={() => setPermanentDeleteConfirmOpen(true)}
                >
                  Delete Permanently
                </Button>
              </>
            )}
          </Box>
        </SectionPaper>

        {/* Deactivate confirmation */}
        <Dialog open={deactivateConfirmOpen} onClose={() => setDeactivateConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Deactivate Employee</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Are you sure you want to deactivate <strong>{employee.first_name} {employee.last_name}</strong>?
              Their login will be blocked immediately - you can reactivate it later from this page.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeactivateConfirmOpen(false)} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate()}
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Permanent delete confirmation */}
        <Dialog open={permanentDeleteConfirmOpen} onClose={() => setPermanentDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Delete Permanently</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>This cannot be undone.</Alert>
            <Typography variant="body2" color="text.secondary">
              Permanently delete <strong>{employee.first_name} {employee.last_name}</strong> and their login?
              Their timesheets, leave, attendance, and assignments will be deleted too. If they have related
              records elsewhere (approvals, vouchers, invoices, etc.) this will be rejected - deactivate them
              instead in that case.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPermanentDeleteConfirmOpen(false)} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={permanentDeleteMutation.isPending}
              onClick={() => permanentDeleteMutation.mutate()}
            >
              {permanentDeleteMutation.isPending ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Invite link result */}
        <Dialog open={!!inviteLink} onClose={() => setInviteLink(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Invite Link</DialogTitle>
          <DialogContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              Send this invite link to the new employee - it lets them see their details and set their own
              username and password. It won't be shown again.
            </Alert>
            <TextField
              fullWidth
              value={inviteLink ?? ''}
              size="small"
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <IconButton
                      size="small"
                      onClick={() => { if (inviteLink) { navigator.clipboard.writeText(inviteLink); toast.success('Copied'); } }}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  ),
                },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInviteLink(null)} variant="contained">Done</Button>
          </DialogActions>
        </Dialog>

        <Divider sx={{ my: 2 }} />
      </Box>
    </motion.div>
  );
};

export default EmployeeDetail;
