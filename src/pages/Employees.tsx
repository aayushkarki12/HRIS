import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  Skeleton,
  InputAdornment,
  Avatar,
  Tooltip,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon,
  Search as SearchIcon,
  PersonOff as PersonOffIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ActivateIcon,
  MailOutlined as InviteIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { employeeService, rbacService, payrollService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Employee } from '../types';

const fmtMoney = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NEW_DESIGNATION_SENTINEL = '__new__';

const employeeSchema = z.object({
  first_name: z.string().min(2, 'First name is required'),
  last_name: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number is required'),
  department: z.string().min(2, 'Department is required'),
  position: z.string().min(2, 'Position is required'),
  joining_date: z.string().min(1, 'Join date is required'),
  seniority_level_id: z.string().optional(),
  role_id: z.string().optional(),
  employment_type: z.enum(['full_time', 'probation']),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

const SkeletonRows: React.FC<{ cols: number }> = ({ cols }) => (
  <>
    {Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <TableCell key={j}>
            <Skeleton height={20} width={j === 0 ? 80 : '70%'} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
);

const Employees: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading, refetch } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
  });

  const { data: seniorityLevels = [] } = useQuery({
    queryKey: ['rbac-seniority-levels'],
    queryFn: () => rbacService.getSeniorityLevels(),
    enabled: isAdmin,
  });
  const seniorityName = (id?: number | null) => (seniorityLevels as any[]).find((l) => l.id === id)?.name;

  const { data: departments = [] } = useQuery({
    queryKey: ['rbac-departments'],
    queryFn: () => rbacService.getDepartments(),
    enabled: isAdmin,
  });

  const { data: roles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => rbacService.getRoles(),
    enabled: isAdmin,
  });

  const [creatingDesignation, setCreatingDesignation] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { employment_type: 'full_time' },
  });

  const positionValue = watch('position');
  const departmentValue = watch('department');
  const seniorityLevelIdValue = watch('seniority_level_id');
  const employmentTypeValue = watch('employment_type');

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => rbacService.createRole({ name, permission_keys: [] }),
    onSuccess: async (newRole: any) => {
      await refetchRoles();
      setValue('position', newRole.name);
      setValue('role_id', String(newRole.id));
      setCreatingDesignation(false);
      setNewDesignationName('');
      toast.success(`"${newRole.name}" created`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create designation')),
  });

  const createMutation = useMutation({
    mutationFn: employeeService.create,
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created successfully');
      setIsModalOpen(false);
      reset();
      setError('');
      if (created?.invite_link) {
        setInviteLink(created.invite_link);
      }
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, 'Failed to create employee');
      toast.error(msg);
      setError(msg);
    },
  });

  // Salary/net pay for the list column - pulled from every active
  // SalaryStructure tenant-wide (admin sees all when no employee_id filter is
  // passed, see HRIS_backend app/api/v1/payroll.py::get_salary_structures).
  // "Not set" is shown for anyone without an active structure - never a
  // fabricated number.
  const { data: salaryStructures = [] } = useQuery({
    queryKey: ['salaryStructures'],
    queryFn: () => payrollService.getSalaryStructures(),
    enabled: isAdmin,
  });
  const netPayByEmployee = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of salaryStructures as any[]) {
      if (s.is_active) map.set(s.employee_id, s.net_pay);
    }
    return map;
  }, [salaryStructures]);

  const deleteMutation = useMutation({
    mutationFn: employeeService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee deactivated');
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to deactivate employee'));
    },
  });

  const activateMutation = useMutation({
    mutationFn: employeeService.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee reactivated - their login works again');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to reactivate employee')),
  });

  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Employee | null>(null);

  const permanentDeleteMutation = useMutation({
    mutationFn: employeeService.permanentDelete,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(result?.message ?? 'Employee permanently deleted');
      setPermanentDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to permanently delete employee'));
      setPermanentDeleteTarget(null);
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: employeeService.resendInvite,
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setInviteLink(result.invite_link);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to resend invite')),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return employees as Employee[];
    const q = search.toLowerCase();
    return (employees as Employee[]).filter(
      (e) =>
        e.first_name.toLowerCase().includes(q) ||
        e.last_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q) ||
        e.employee_id?.toLowerCase().includes(q),
    );
  }, [employees, search]);

  // Creation only - editing an existing employee now happens on the full
  // /employees/:id detail page instead of this dialog (see EmployeeDetail.tsx).
  const onSubmit = (data: EmployeeFormData) => {
    setError('');
    const { seniority_level_id, role_id, ...rest } = data;
    const payload = {
      ...rest,
      seniority_level_id: seniority_level_id ? Number(seniority_level_id) : null,
      role_id: role_id && role_id !== NEW_DESIGNATION_SENTINEL ? Number(role_id) : null,
    };
    createMutation.mutate(payload);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setError('');
    setCreatingDesignation(false);
    setNewDesignationName('');
  };

  const colCount = isAdmin ? 12 : 11;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              Employees
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {isLoading ? '—' : `${(employees as Employee[]).length} total`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ width: 220 }}
            />
            {isAdmin && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setIsModalOpen(true)}
                size="small"
              >
                Add Employee
              </Button>
            )}
          </Box>
        </Box>

        {/* Table */}
        <Paper
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            boxShadow: 'none',
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell>Projects</TableCell>
                  <TableCell>Seniority</TableCell>
                  <TableCell>Employment</TableCell>
                  <TableCell align="right">Net Pay</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Login</TableCell>
                  {isAdmin && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <SkeletonRows cols={colCount} />
                ) : filtered.length > 0 ? (
                  filtered.map((employee) => (
                    <TableRow
                      key={employee.id}
                      hover
                      onClick={() => navigate(`/employees/${employee.id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: 'primary.main',
                              flexShrink: 0,
                            }}
                          >
                            {employee.first_name?.[0]}{employee.last_name?.[0]}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {employee.first_name} {employee.last_name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {employee.employee_id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {employee.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{employee.department}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{employee.position}</Typography>
                      </TableCell>
                      <TableCell>
                        {(employee as any).projects?.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(employee as any).projects.map((p: string) => (
                              <Chip key={p} label={p} size="small" variant="outlined" color="primary" />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {seniorityName((employee as any).seniority_level_id) ? (
                          <Chip label={seniorityName((employee as any).seniority_level_id)} size="small" variant="outlined" />
                        ) : (
                          <Typography variant="body2" color="text.disabled">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={employee.employment_type === 'probation' ? 'Probation' : 'Full-time'}
                          color={employee.employment_type === 'probation' ? 'warning' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {netPayByEmployee.has(employee.id) ? (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#2ecc71' }}>
                            {fmtMoney(netPayByEmployee.get(employee.id)!)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.disabled">Not set</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={employee.is_active ? 'Active' : 'Inactive'}
                          color={employee.is_active ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        {employee.invite_status === 'invited' && <Chip label="Invited" color="warning" size="small" variant="outlined" />}
                        {employee.invite_status === 'expired' && <Chip label="Expired" color="error" size="small" variant="outlined" />}
                        {employee.invite_status === 'accepted' && <Chip label="Accepted" color="success" size="small" variant="outlined" />}
                        {!employee.invite_status && <Typography variant="body2" color="text.disabled">-</Typography>}
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          {/* Row click navigates to the full detail page (view/edit
                              everything there) - these stay here too as quick
                              actions, hence stopPropagation so clicking one
                              doesn't also trigger the row navigation. */}
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            {(employee.invite_status === 'invited' || employee.invite_status === 'expired') && (
                              <Tooltip title="Copy a fresh invite link">
                                <IconButton
                                  size="small"
                                  color="info"
                                  disabled={resendInviteMutation.isPending}
                                  onClick={() => resendInviteMutation.mutate(employee.id)}
                                >
                                  <InviteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {employee.is_active ? (
                              <Tooltip title="Deactivate - blocks their login">
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteTarget(employee)}
                                  color="error"
                                >
                                  <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <>
                                <Tooltip title="Reactivate - restores their login">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    disabled={activateMutation.isPending}
                                    onClick={() => activateMutation.mutate(employee.id)}
                                  >
                                    <ActivateIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete permanently - cannot be undone">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => setPermanentDeleteTarget(employee)}
                                  >
                                    <DeleteForeverIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={colCount} sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.disabled">
                        {search ? `No employees match "${search}"` : 'No employees found'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Add dialog - editing an existing employee happens on the full
            /employees/:id detail page instead (click any row), not here. */}
        <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            Add Employee
          </DialogTitle>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogContent sx={{ pt: 1 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Alert severity="info" sx={{ mb: 2 }}>
                Employee ID is generated automatically. A login will also be created and you'll get an invite
                link to share with them so they can set their own username and password.
              </Alert>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField
                  fullWidth
                  label="First Name"
                  {...register('first_name')}
                  error={!!errors.first_name}
                  helperText={errors.first_name?.message}
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Last Name"
                  {...register('last_name')}
                  error={!!errors.last_name}
                  helperText={errors.last_name?.message}
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  {...register('email')}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  size="small"
                  sx={{ gridColumn: '1 / -1' }}
                />
                <TextField
                  fullWidth
                  label="Phone"
                  {...register('phone')}
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  size="small"
                  sx={{ gridColumn: '1 / -1' }}
                />
                <TextField
                  fullWidth
                  select
                  label="Department"
                  value={departmentValue ?? ''}
                  onChange={(e) => setValue('department', e.target.value, { shouldValidate: true })}
                  error={!!errors.department}
                  helperText={errors.department?.message}
                  size="small"
                >
                  {departmentValue && !(departments as any[]).some((d) => d.name === departmentValue) && (
                    <MenuItem value={departmentValue}>{departmentValue} (not in list)</MenuItem>
                  )}
                  {(departments as any[]).map((d) => (
                    <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  label="Join Date"
                  type="date"
                  {...register('joining_date')}
                  error={!!errors.joining_date}
                  helperText={errors.joining_date?.message}
                  size="small"
                  sx={{ gridColumn: '1 / -1' }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  fullWidth
                  select
                  label="Employment Status"
                  value={employmentTypeValue ?? 'full_time'}
                  onChange={(e) => setValue('employment_type', e.target.value as 'full_time' | 'probation', { shouldValidate: true })}
                  error={!!errors.employment_type}
                  helperText={errors.employment_type?.message || 'Probation employees get a reduced leave allocation until confirmed'}
                  size="small"
                  sx={{ gridColumn: '1 / -1' }}
                >
                  <MenuItem value="full_time">Full-time</MenuItem>
                  <MenuItem value="probation">Probation</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  select
                  label="Seniority Level"
                  value={seniorityLevelIdValue ?? ''}
                  onChange={(e) => setValue('seniority_level_id', e.target.value)}
                  error={!!errors.seniority_level_id}
                  helperText={errors.seniority_level_id?.message || 'Affects approval limits, e.g. how large an invoice a Senior Accountant can approve'}
                  size="small"
                  sx={{ gridColumn: '1 / -1' }}
                >
                  <MenuItem value="">None</MenuItem>
                  {(seniorityLevels as any[]).map((level) => (
                    <MenuItem key={level.id} value={String(level.id)}>{level.name}</MenuItem>
                  ))}
                </TextField>
                {creatingDesignation ? (
                  <Box sx={{ display: 'flex', gap: 1, gridColumn: '1 / -1' }}>
                    <TextField
                      fullWidth
                      autoFocus
                      label="New Position / Designation"
                      value={newDesignationName}
                      onChange={(e) => setNewDesignationName(e.target.value)}
                      size="small"
                      placeholder="e.g. Senior Developer"
                    />
                    <Button
                      variant="contained"
                      size="small"
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
                    fullWidth
                    select
                    label="Position / Designation"
                    value={positionValue ?? ''}
                    onChange={(e) => {
                      if (e.target.value === NEW_DESIGNATION_SENTINEL) {
                        setCreatingDesignation(true);
                        return;
                      }
                      setValue('position', e.target.value);
                      const role = (roles as any[]).find((r) => r.name === e.target.value);
                      setValue('role_id', role ? String(role.id) : '');
                    }}
                    error={!!errors.position}
                    helperText={errors.position?.message || "Sets the job title and grants the new login this designation's permissions"}
                    size="small"
                    sx={{ gridColumn: '1 / -1' }}
                  >
                    {positionValue && !(roles as any[]).some((r) => r.name === positionValue) && (
                      <MenuItem value={positionValue}>{positionValue} (not in list)</MenuItem>
                    )}
                    {(roles as any[]).map((r) => (
                      <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
                    ))}
                    <MenuItem value={NEW_DESIGNATION_SENTINEL} sx={{ fontStyle: 'italic' }}>+ Create New…</MenuItem>
                  </TextField>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={handleCloseModal} color="inherit">Cancel</Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Create'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Deactivate confirmation dialog */}
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: '#FEF2F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <PersonOffIcon sx={{ fontSize: 18, color: 'error.main' }} />
              </Box>
              Deactivate Employee
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Are you sure you want to deactivate{' '}
              <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong>?
              Their login will be blocked immediately - you can reactivate it later from this page.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteTarget(null)} color="inherit">Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Permanent delete confirmation dialog (only reachable once an employee is already deactivated) */}
        <Dialog open={!!permanentDeleteTarget} onClose={() => setPermanentDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: '#FEF2F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DeleteForeverIcon sx={{ fontSize: 18, color: 'error.main' }} />
              </Box>
              Delete Permanently
            </Box>
          </DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>This cannot be undone.</Alert>
            <Typography variant="body2" color="text.secondary">
              Permanently delete <strong>{permanentDeleteTarget?.first_name} {permanentDeleteTarget?.last_name}</strong> and
              their login? Their timesheets, leave, attendance, and assignments will be deleted too. If they have
              related records elsewhere (approvals, vouchers, invoices, etc.) this will be rejected - deactivate
              them instead in that case.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPermanentDeleteTarget(null)} color="inherit">Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={permanentDeleteMutation.isPending}
              onClick={() => permanentDeleteTarget && permanentDeleteMutation.mutate(permanentDeleteTarget.id)}
            >
              {permanentDeleteMutation.isPending ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Career history moved to the full /employees/:id detail page
            (click any row) - it's shown inline there now instead of a popup. */}

        {/* Invite link result (shown once, right after creating an employee) */}
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
      </Box>
    </motion.div>
  );
};

export default Employees;
