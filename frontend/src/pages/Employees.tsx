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
  ToggleButtonGroup,
  ToggleButton,
  Autocomplete,
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
import { employeeService, rbacService, workLocationService, projectService, userService, getErrorMessage } from '../services/api';
import { sendInviteEmailLink, isFirebaseConfigured } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { Employee } from '../types';

const NEW_DESIGNATION_SENTINEL = '__new__';

// Curated common-country subset, not an exhaustive list - default is Nepal
// since that's where this company is based. The phone number entered here
// becomes the invite's phone_suggestion (see AcceptInvitation.tsx), which
// the new hire still has to verify themselves via Firebase OTP.
const COUNTRY_CODES = [
  { code: '+977', label: 'Nepal (+977)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'US/Canada (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+65', label: 'Singapore (+65)' },
];

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
  employment_type: z.enum(['full_time', 'probation', 'contractor']),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_SHIFT_FORM = {
  attendance_type: 'individual' as 'fixed' | 'individual' | 'contractor',
  assigned_work_location_id: '' as string | number,
  fixed_clock_in_time: '',
  fixed_clock_out_time: '',
  shift_working_days: [] as string[],
  contract_hours_per_period: '' as string | number,
  contract_hours_period: '' as '' | 'day' | 'week' | 'month',
};

const DEFAULT_EMPLOYMENT_EXTRAS = {
  reports_to_employee_id: '' as string | number,
  contract_end_date: '',
};

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
  const { isAdmin, isManager, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  // A site-scoped role (e.g. "Site Manager") can hold employees.edit
  // without being isAdmin/isManager - the backend's create_employee already
  // restricts what they can set (their own site only, no role_id); this
  // just routes them to the simpler dialog that matches that restriction
  // instead of the full admin form (which assumes free rein over role/site).
  const canAddEmployee = isAdmin || hasPermission('employees.edit');
  const isSiteScopedCreator = !isAdmin && !isManager && hasPermission('employees.edit');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading, refetch } = useQuery({
    queryKey: ['employees', siteFilter],
    queryFn: () => employeeService.getAll(siteFilter ? { work_location_id: Number(siteFilter) } : undefined),
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
  const [inviteEmailStatus, setInviteEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteEmailError, setInviteEmailError] = useState('');

  // Firebase (not our own backend) sends the actual invite email - it's the
  // link that has to reach the real inbox for email verification to mean
  // anything, since opening it is what proves the new hire controls that
  // address (see POST /auth/verify-email-invite). The copyable link in the
  // dialog below stays as a manual fallback if this fails or isn't configured.
  const triggerInviteEmail = async (email: string, link: string) => {
    if (!isFirebaseConfigured()) {
      setInviteEmailStatus('error');
      setInviteEmailError("Firebase isn't configured on this deployment - share the link below manually.");
      return;
    }
    setInviteEmailStatus('sending');
    try {
      await sendInviteEmailLink(email, link);
      setInviteEmailStatus('sent');
    } catch (err: any) {
      setInviteEmailStatus('error');
      setInviteEmailError(err?.message || 'Failed to send the invite email - share the link below manually.');
    }
  };
  const [phoneCountryCode, setPhoneCountryCode] = useState('+977');

  // Shift is entirely optional at creation time - a fresh hire defaults to
  // "individual" (flexible, no fixed site/time) unless the admin opts into
  // "fixed" here. Kept as separate local state rather than threaded through
  // the react-hook-form/zod schema above since none of it is required.
  const [shiftForm, setShiftForm] = useState(DEFAULT_SHIFT_FORM);
  const [employmentExtras, setEmploymentExtras] = useState(DEFAULT_EMPLOYMENT_EXTRAS);
  const [selectedProjects, setSelectedProjects] = useState<any[]>([]);
  const [primaryProjectId, setPrimaryProjectId] = useState<string | number>('');

  const handleProjectsChange = (value: any[]) => {
    setSelectedProjects(value);
    // Keep the primary selection valid as the project list changes -
    // default to the first pick, clear it if nothing's selected anymore.
    if (value.length === 0) {
      setPrimaryProjectId('');
    } else if (!value.some((p) => p.id === primaryProjectId)) {
      setPrimaryProjectId(value[0].id);
    }
  };

  const { data: workLocationsTree = [] } = useQuery({
    queryKey: ['workLocationsTree'],
    queryFn: workLocationService.getTree,
  });

  // Flattened, indented (factory, then its plants) - used for the site
  // filter dropdown and to resolve an employee's site name for the table.
  const flatSites = useMemo(() => {
    const out: { id: number; name: string; depth: number; is_office?: boolean }[] = [];
    (workLocationsTree as any[]).forEach((loc) => {
      out.push({ id: loc.id, name: loc.name, depth: 0, is_office: loc.is_office });
      (loc.children ?? []).forEach((child: any) => out.push({ id: child.id, name: child.name, depth: 1, is_office: child.is_office }));
    });
    return out;
  }, [workLocationsTree]);
  const siteNameById = useMemo(() => {
    const map: Record<number, string> = {};
    flatSites.forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [flatSites]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll(),
    enabled: isAdmin,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { employment_type: 'full_time' },
  });

  const positionValue = watch('position');
  const departmentValue = watch('department');
  const seniorityLevelIdValue = watch('seniority_level_id');
  const employmentTypeValue = watch('employment_type');
  const roleIdValue = watch('role_id');
  const selectedRole = (roles as any[]).find((r) => String(r.id) === roleIdValue);
  const [managedSites, setManagedSites] = useState<{ id: number; name: string; depth: number }[]>([]);

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
    onSuccess: async (created: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created successfully');
      setIsModalOpen(false);
      reset();
      setError('');
      setPhoneCountryCode('+977');
      setShiftForm(DEFAULT_SHIFT_FORM);
      setEmploymentExtras(DEFAULT_EMPLOYMENT_EXTRAS);

      if (created?.id && selectedProjects.length > 0) {
        const results = await Promise.allSettled(
          selectedProjects.map((p) => projectService.addMember(p.id, created.id))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          toast.error(`Added to ${selectedProjects.length - failed}/${selectedProjects.length} project(s) - couldn't add to the rest`);
        } else {
          toast.success(`Assigned to ${selectedProjects.length} project${selectedProjects.length > 1 ? 's' : ''}`);
        }
        queryClient.invalidateQueries({ queryKey: ['project-members'] });
      }
      setSelectedProjects([]);
      setPrimaryProjectId('');

      if (created?.user_id && managedSites.length > 0) {
        const results = await Promise.allSettled(
          managedSites.map((s) => userService.addSiteAssignment(created.user_id, s.id))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          toast.error(`Assigned ${managedSites.length - failed}/${managedSites.length} site(s) to manage - couldn't assign the rest`);
        } else {
          toast.success(`Can manage ${managedSites.length} site${managedSites.length > 1 ? 's' : ''}`);
        }
      }
      setManagedSites([]);

      if (created?.invite_link) {
        setInviteLink(created.invite_link);
        setInviteEmailStatus('idle');
        setInviteEmailError('');
        if (created.email) triggerInviteEmail(created.email, created.invite_link);
      }
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, 'Failed to create employee');
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
    mutationFn: ({ id }: { id: number; email: string }) => employeeService.resendInvite(id),
    onSuccess: (result: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setInviteLink(result.invite_link);
      setInviteEmailStatus('idle');
      setInviteEmailError('');
      if (variables.email && result.invite_link) triggerInviteEmail(variables.email, result.invite_link);
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
    const { seniority_level_id, role_id, phone, ...rest } = data;
    const payload = {
      ...rest,
      phone: `${phoneCountryCode}${phone.replace(/\D/g, '')}`,
      seniority_level_id: seniority_level_id ? Number(seniority_level_id) : null,
      role_id: role_id && role_id !== NEW_DESIGNATION_SENTINEL ? Number(role_id) : null,
      attendance_type: shiftForm.attendance_type,
      assigned_work_location_id: shiftForm.assigned_work_location_id === '' ? null : Number(shiftForm.assigned_work_location_id),
      fixed_clock_in_time: shiftForm.fixed_clock_in_time || null,
      fixed_clock_out_time: shiftForm.fixed_clock_out_time || null,
      shift_working_days: shiftForm.shift_working_days.length > 0 ? shiftForm.shift_working_days.join(',') : null,
      contract_hours_per_period: shiftForm.contract_hours_per_period === '' ? null : Number(shiftForm.contract_hours_per_period),
      contract_hours_period: shiftForm.contract_hours_period || null,
      reports_to_employee_id: employmentExtras.reports_to_employee_id === '' ? null : Number(employmentExtras.reports_to_employee_id),
      contract_end_date: employmentExtras.contract_end_date || null,
      primary_project_id: selectedProjects.length > 0 ? Number(primaryProjectId) : null,
    };
    createMutation.mutate(payload);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setError('');
    setCreatingDesignation(false);
    setNewDesignationName('');
    setPhoneCountryCode('+977');
    setShiftForm(DEFAULT_SHIFT_FORM);
    setEmploymentExtras(DEFAULT_EMPLOYMENT_EXTRAS);
    setSelectedProjects([]);
    setPrimaryProjectId('');
    setManagedSites([]);
  };

  const colCount = isAdmin ? 12 : 11;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>
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
            {flatSites.length > 0 && (
              <TextField
                size="small"
                select
                label="Site"
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                sx={{ width: 180 }}
              >
                <MenuItem value="">All sites</MenuItem>
                {flatSites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>{'  '.repeat(s.depth)}{s.name}</MenuItem>
                ))}
              </TextField>
            )}
            {canAddEmployee && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => (isSiteScopedCreator ? setSiteDialogOpen(true) : setIsModalOpen(true))}
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
            <Table sx={{ minWidth: 1100 }} size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Site</TableCell>
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
                  filtered.map((employee) => {
                    const canOpenDetail = isAdmin || isManager || hasPermission('employees.view_all') || employee.user_id === user?.id;
                    return (
                    <TableRow
                      key={employee.id}
                      hover={canOpenDetail}
                      onClick={canOpenDetail ? () => navigate(`/employees/${employee.id}`) : undefined}
                      sx={{ cursor: canOpenDetail ? 'pointer' : 'default' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: '#FFFFFF',
                              color: '#334155',
                              border: '1.5px solid #CBD5E1',
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
                        <Typography variant="body2" color={(employee as any).assigned_work_location_id ? 'text.primary' : 'text.disabled'}>
                          {(employee as any).assigned_work_location_id ? (siteNameById[(employee as any).assigned_work_location_id] ?? '—') : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{employee.position}</Typography>
                      </TableCell>
                      <TableCell>
                        {(employee as any).projects?.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(employee as any).projects.map((p: string) => (
                              <Chip key={p} label={p} size="small" variant="outlined" sx={{ borderColor: '#818CF8', color: '#4F46E5' }} />
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
                          label={employee.employment_type === 'probation' ? 'Probation' : employee.employment_type === 'contractor' ? 'Contractor' : 'Full-time'}
                          color={employee.employment_type === 'probation' ? 'warning' : employee.employment_type === 'contractor' ? 'info' : 'default'}
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
                                  onClick={() => resendInviteMutation.mutate({ id: employee.id, email: employee.email })}
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
                    );
                  })
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
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                    1. Basic Info
                  </Typography>
                </Box>
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
                <Box sx={{ display: 'flex', gap: 1, gridColumn: '1 / -1' }}>
                  <TextField
                    select
                    label="Code"
                    value={phoneCountryCode}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                    size="small"
                    sx={{ minWidth: 130, flexShrink: 0 }}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    placeholder="9812345678"
                    {...register('phone')}
                    error={!!errors.phone}
                    helperText={errors.phone?.message || `Will be saved as ${phoneCountryCode}...`}
                    size="small"
                  />
                </Box>

                <Box sx={{ gridColumn: '1 / -1', mt: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                    2. Employment
                  </Typography>
                </Box>
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
                  onChange={(e) => setValue('employment_type', e.target.value as 'full_time' | 'probation' | 'contractor', { shouldValidate: true })}
                  error={!!errors.employment_type}
                  helperText={errors.employment_type?.message || 'Probation gets a reduced leave allocation; contractors get none'}
                  size="small"
                  sx={{ gridColumn: '1 / -1' }}
                >
                  <MenuItem value="full_time">Full-time</MenuItem>
                  <MenuItem value="probation">Probation</MenuItem>
                  <MenuItem value="contractor">Contractor</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  select
                  label="Seniority Level"
                  value={seniorityLevelIdValue ?? ''}
                  onChange={(e) => setValue('seniority_level_id', e.target.value)}
                  error={!!errors.seniority_level_id}
                  helperText={errors.seniority_level_id?.message || 'Affects seniority-based access within the organization'}
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
                <TextField
                  fullWidth select size="small" label="Reports To (optional)"
                  value={employmentExtras.reports_to_employee_id === '' ? '' : String(employmentExtras.reports_to_employee_id)}
                  onChange={(e) => setEmploymentExtras({ ...employmentExtras, reports_to_employee_id: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {(employees as any[]).map((e) => (
                    <MenuItem key={e.id} value={String(e.id)}>{e.first_name} {e.last_name}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth size="small" label="Contract End Date (optional)" type="date"
                  value={employmentExtras.contract_end_date}
                  onChange={(e) => setEmploymentExtras({ ...employmentExtras, contract_end_date: e.target.value })}
                  helperText="For fixed-term/contractor engagements"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                {selectedRole?.scope === 'site' && (
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Autocomplete
                      multiple
                      size="small"
                      options={flatSites}
                      getOptionLabel={(s) => `${'    '.repeat(s.depth)}${s.name}`}
                      value={managedSites}
                      onChange={(_, value) => setManagedSites(value)}
                      renderInput={(params) => (
                        <TextField {...params} label="Sites this person can manage" helperText={`"${selectedRole.name}" only sees employees/attendance at their assigned site(s)`} />
                      )}
                    />
                  </Box>
                )}

                <Box sx={{ gridColumn: '1 / -1', mt: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                    3. Shift (optional)
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Attendance Type"
                  value={shiftForm.attendance_type}
                  onChange={(e) => setShiftForm({ ...shiftForm, attendance_type: e.target.value as 'fixed' | 'individual' | 'contractor' })}
                  sx={{ gridColumn: shiftForm.attendance_type === 'fixed' ? undefined : '1 / -1' }}
                  helperText="Fixed: assigned site & time. Individual: flexible. Contractor: freeform, cross-day."
                >
                  <MenuItem value="individual">Individual (flexible)</MenuItem>
                  <MenuItem value="fixed">Fixed (assigned site & time)</MenuItem>
                  <MenuItem value="contractor">Contractor (freeform, cross-day)</MenuItem>
                </TextField>
                {shiftForm.attendance_type === 'fixed' && (
                  <>
                    <TextField
                      fullWidth select size="small" label="Assigned Site"
                      value={shiftForm.assigned_work_location_id === '' ? '' : String(shiftForm.assigned_work_location_id)}
                      onChange={(e) => setShiftForm({ ...shiftForm, assigned_work_location_id: e.target.value })}
                    >
                      <MenuItem value="">None</MenuItem>
                      {flatSites.map((loc) => (
                        <MenuItem key={loc.id} value={String(loc.id)}>{'    '.repeat(loc.depth)}{loc.is_office ? `${loc.name} (Office)` : loc.name}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      fullWidth size="small" label="Fixed Clock-In Time" type="time"
                      value={shiftForm.fixed_clock_in_time}
                      onChange={(e) => setShiftForm({ ...shiftForm, fixed_clock_in_time: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      fullWidth size="small" label="Fixed Clock-Out Time" type="time"
                      value={shiftForm.fixed_clock_out_time}
                      onChange={(e) => setShiftForm({ ...shiftForm, fixed_clock_out_time: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Working Days (optional - leave empty for every day)
                      </Typography>
                      <ToggleButtonGroup
                        value={shiftForm.shift_working_days}
                        onChange={(_, days: string[]) => setShiftForm({ ...shiftForm, shift_working_days: days })}
                        size="small"
                      >
                        {WEEKDAYS.map((d) => (
                          <ToggleButton key={d} value={d} sx={{ px: 1.5, fontSize: '0.75rem' }}>{d}</ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    </Box>
                  </>
                )}

                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Or, for hours-based arrangements instead of fixed days (e.g. "30 hours/month")
                  </Typography>
                </Box>
                <TextField
                  fullWidth size="small" label="Contract Hours" type="number"
                  value={shiftForm.contract_hours_per_period}
                  onChange={(e) => setShiftForm({ ...shiftForm, contract_hours_per_period: e.target.value })}
                  slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                />
                <TextField
                  fullWidth select size="small" label="Per"
                  value={shiftForm.contract_hours_period}
                  onChange={(e) => setShiftForm({ ...shiftForm, contract_hours_period: e.target.value as '' | 'day' | 'week' | 'month' })}
                >
                  <MenuItem value="">-</MenuItem>
                  <MenuItem value="day">Day</MenuItem>
                  <MenuItem value="week">Week</MenuItem>
                  <MenuItem value="month">Month</MenuItem>
                </TextField>

                <Box sx={{ gridColumn: '1 / -1', mt: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block', mb: 1 }}>
                    4. Project Assignment (optional)
                  </Typography>
                  <Autocomplete
                    multiple
                    size="small"
                    options={(projects as any[])}
                    value={selectedProjects}
                    onChange={(_, value) => handleProjectsChange(value)}
                    getOptionLabel={(p: any) => p.name}
                    isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
                    renderInput={(params) => <TextField {...params} placeholder="Add to project(s)…" />}
                  />
                  {selectedProjects.length > 1 && (
                    <TextField
                      fullWidth select size="small" label="Primary Project" sx={{ mt: 1.5 }}
                      value={primaryProjectId}
                      onChange={(e) => setPrimaryProjectId(e.target.value)}
                      helperText="Used for clock-in geofencing when they're on multiple projects"
                    >
                      {selectedProjects.map((p: any) => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </TextField>
                  )}
                </Box>
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
              related records elsewhere (approvals, timesheets, etc.) this will be rejected - deactivate
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
            {inviteEmailStatus === 'sending' && (
              <Alert severity="info" sx={{ mb: 2 }}>Sending the verification email…</Alert>
            )}
            {inviteEmailStatus === 'sent' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Verification email sent - the new hire must open it to verify their email before they can finish
                setup. The link below is a manual fallback if the email doesn't arrive.
              </Alert>
            )}
            {inviteEmailStatus === 'error' && (
              <Alert severity="warning" sx={{ mb: 2 }}>{inviteEmailError}</Alert>
            )}
            {inviteEmailStatus === 'idle' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Send this invite link to the new employee - it lets them see their details and set their own
                username and password. It won't be shown again.
              </Alert>
            )}
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

        <AddSiteEmployeeDialog
          open={siteDialogOpen}
          onClose={() => setSiteDialogOpen(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            setSiteDialogOpen(false);
          }}
        />
      </Box>
    </motion.div>
  );
};

// Simpler counterpart to the big admin form above, for a site-scoped
// employees.edit holder (e.g. a "Site Manager") adding someone to their own
// site. No role/position-as-designation picker (the backend rejects
// role_id from this kind of caller outright), no "sites this person can
// manage" - just the basics, with site and reporting line set
// automatically rather than picked, since there's only ever one sensible
// answer for "whose site" and "reports to whom" here: the creator's own.
const AddSiteEmployeeDialog: React.FC<{ open: boolean; onClose: () => void; onCreated: () => void }> = ({ open, onClose, onCreated }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mySites, setMySites] = useState<{ id: number; name: string; depth: number }[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState<number | null>(null);
  const [assignedSiteId, setAssignedSiteId] = useState<number | ''>('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    department: '', position: '', joining_date: '', employment_type: 'full_time',
  });

  React.useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    setLoadError('');
    setInviteLink(null);
    setForm({ first_name: '', last_name: '', email: '', phone: '', department: '', position: '', joining_date: '', employment_type: 'full_time' });
    (async () => {
      try {
        const [me, assignments, tree] = await Promise.all([
          employeeService.getMyProfile(),
          userService.getSiteAssignments(user.id),
          workLocationService.getTree(),
        ]);
        const flat: { id: number; name: string; depth: number }[] = [];
        (tree as any[]).forEach((loc) => {
          flat.push({ id: loc.id, name: loc.name, depth: 0 });
          (loc.children ?? []).forEach((c: any) => flat.push({ id: c.id, name: c.name, depth: 1 }));
        });
        const myActiveSiteIds = (assignments as any[]).filter((a) => a.is_active).map((a) => a.work_location_id);
        const mine = flat.filter((s) => myActiveSiteIds.includes(s.id));
        setMyEmployeeId(me.id);
        setMySites(mine);
        setAssignedSiteId(mine.length === 1 ? mine[0].id : '');
      } catch (e: any) {
        setLoadError(getErrorMessage(e, 'Could not load your site assignment'));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => employeeService.create(payload),
    onSuccess: (created: any) => {
      toast.success('Employee added to your site');
      if (created?.invite_link) setInviteLink(created.invite_link);
      else onCreated();
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to add employee')),
  });

  const handleSubmit = () => {
    if (!myEmployeeId || !assignedSiteId) return;
    createMutation.mutate({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      department: form.department.trim(),
      position: form.position.trim(),
      joining_date: form.joining_date,
      employment_type: form.employment_type,
      assigned_work_location_id: assignedSiteId,
      reports_to_employee_id: myEmployeeId,
    });
  };

  const valid = form.first_name.trim() && form.last_name.trim() && form.email.trim().includes('@') &&
    form.department.trim().length >= 2 && form.position.trim().length >= 2 && form.joining_date && assignedSiteId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{inviteLink ? 'Employee added' : 'Add Employee'}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}><Skeleton height={200} /></Box>
        ) : loadError ? (
          <Alert severity="error">{loadError}</Alert>
        ) : inviteLink ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Alert severity="success">
              Share this link with them to set up the app - it won't be shown again.
            </Alert>
            <TextField
              fullWidth size="small" value={inviteLink}
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <IconButton size="small" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copied'); }}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  ),
                },
              }}
            />
          </Box>
        ) : mySites.length === 0 ? (
          <Alert severity="warning">
            You don't have a site assigned yet - ask an admin to assign you one before adding employees.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Alert severity="info" sx={{ mb: 0.5 }}>
              This employee will be added under you, at your own site - you can't assign a role here.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField fullWidth size="small" label="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <TextField fullWidth size="small" label="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Box>
            <TextField fullWidth size="small" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <TextField fullWidth size="small" label="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField fullWidth size="small" label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <TextField fullWidth size="small" label="Position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </Box>
            <TextField
              fullWidth size="small" label="Joining Date" type="date" value={form.joining_date}
              onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              fullWidth select size="small" label="Employment Status" value={form.employment_type}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
            >
              <MenuItem value="full_time">Full-time</MenuItem>
              <MenuItem value="probation">Probation</MenuItem>
              <MenuItem value="contractor">Contractor</MenuItem>
            </TextField>
            {mySites.length === 1 ? (
              <TextField fullWidth size="small" label="Site" value={mySites[0].name} disabled />
            ) : (
              <TextField
                fullWidth select size="small" label="Your site" value={assignedSiteId}
                onChange={(e) => setAssignedSiteId(Number(e.target.value))}
              >
                {mySites.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{'    '.repeat(s.depth)}{s.name}</MenuItem>
                ))}
              </TextField>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {inviteLink ? (
          <Button onClick={() => { setInviteLink(null); onCreated(); }} variant="contained">Done</Button>
        ) : (
          <>
            <Button onClick={onClose} color="inherit">Cancel</Button>
            <Button
              variant="contained"
              disabled={!valid || createMutation.isPending || mySites.length === 0}
              onClick={handleSubmit}
            >
              {createMutation.isPending ? 'Adding…' : 'Add Employee'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default Employees;
