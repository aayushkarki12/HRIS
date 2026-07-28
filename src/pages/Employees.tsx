import React, { useState, useMemo } from 'react';
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
  Edit as EditIcon,
  Delete as DeleteIcon,
  DeleteForever as DeleteForeverIcon,
  Search as SearchIcon,
  PersonOff as PersonOffIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ActivateIcon,
  MailOutlined as InviteIcon,
  History as HistoryIcon,
  WorkHistory as JoinedIcon,
  TrendingUp as PromotionIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { employeeService, rbacService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Employee } from '../types';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
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
      if (!editingId) {
        setValue('role_id', String(newRole.id));
      }
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => employeeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated successfully');
      setIsModalOpen(false);
      reset();
      setEditingId(null);
      setError('');
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, 'Failed to update employee');
      toast.error(msg);
      setError(msg);
    },
  });

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

  const [historyTarget, setHistoryTarget] = useState<Employee | null>(null);
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['employee-history', historyTarget?.id],
    queryFn: () => employeeService.getHistory(historyTarget!.id),
    enabled: !!historyTarget,
  });
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

  const onSubmit = (data: EmployeeFormData) => {
    setError('');
    const { seniority_level_id, role_id, ...rest } = data;
    if (editingId) {
      const payload = { ...rest, seniority_level_id: seniority_level_id ? Number(seniority_level_id) : null };
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      const payload = {
        ...rest,
        seniority_level_id: seniority_level_id ? Number(seniority_level_id) : null,
        role_id: role_id && role_id !== NEW_DESIGNATION_SENTINEL ? Number(role_id) : null,
      };
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setValue('first_name', employee.first_name);
    setValue('last_name', employee.last_name);
    setValue('email', employee.email);
    setValue('phone', employee.phone);
    setValue('department', employee.department);
    setValue('position', employee.position);
    setValue('joining_date', employee.joining_date.split('T')[0]);
    setValue('seniority_level_id', (employee as any).seniority_level_id ? String((employee as any).seniority_level_id) : '');
    setValue('employment_type', (employee as any).employment_type === 'probation' ? 'probation' : 'full_time');
    setIsModalOpen(true);
    setError('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setEditingId(null);
    setError('');
    setCreatingDesignation(false);
    setNewDesignationName('');
  };

  const colCount = isAdmin ? 11 : 10;
  const editingEmployee = editingId ? (employees as Employee[]).find((e) => e.id === editingId) : null;

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
                    <TableRow key={employee.id} hover>
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
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEdit(employee)} color="primary">
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Career history">
                              <IconButton size="small" onClick={() => setHistoryTarget(employee)} color="inherit">
                                <HistoryIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
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

        {/* Add / Edit dialog */}
        <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pb: editingEmployee ? 0 : 1 }}>
            {editingId ? 'Edit Employee' : 'Add Employee'}
            {editingEmployee && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace' }}>
                {editingEmployee.employee_id}
              </Typography>
            )}
          </DialogTitle>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogContent sx={{ pt: 1 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {!editingId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Employee ID is generated automatically. A login will also be created and you'll get an invite
                  link to share with them so they can set their own username and password.
                </Alert>
              )}
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
                      if (!editingId) {
                        const role = (roles as any[]).find((r) => r.name === e.target.value);
                        setValue('role_id', role ? String(role.id) : '');
                      }
                    }}
                    error={!!errors.position}
                    helperText={errors.position?.message || (editingId
                      ? 'Updates their job title. To change what permissions their login has, use Users & Roles.'
                      : "Sets the job title and grants the new login this designation's permissions")}
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
                {isSubmitting ? 'Saving…' : editingId ? 'Update' : 'Create'}
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

        {/* Career history timeline */}
        <Dialog open={!!historyTarget} onClose={() => setHistoryTarget(null)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Career History
            {historyTarget && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {historyTarget.first_name} {historyTarget.last_name}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <Skeleton variant="rectangular" width="100%" height={120} />
              </Box>
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
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHistoryTarget(null)}>Close</Button>
          </DialogActions>
        </Dialog>

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
