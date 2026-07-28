import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, MenuItem, IconButton, Tabs, Tab,
  Checkbox, FormControlLabel, FormGroup, Divider,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
} from '@mui/icons-material';
import { rbacService, getErrorMessage } from '../services/api';

// Permissions whose enforcement point checks a dollar amount against the
// resolved approval limit - see AMOUNT_LIMITED_PERMISSIONS in
// app/core/permissions.py. Approval limits only make sense for these keys.
const AMOUNT_LIMITED_PERMISSIONS = [
  'voucher.approve',
  'invoice.approve',
  'expense.approve_accounting',
  'budget.approve',
];

interface TabPanelProps {
  value: number;
  index: number;
  children: React.ReactNode;
}
const TabPanel: React.FC<TabPanelProps> = ({ value, index, children }) => (
  <div hidden={value !== index}>{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}</div>
);

const RolesPermissions: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);

  // ---------- data ----------
  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: () => rbacService.getPermissions(),
  });
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => rbacService.getRoles(),
  });
  const { data: seniorityLevels, isLoading: seniorityLoading } = useQuery({
    queryKey: ['rbac-seniority-levels'],
    queryFn: () => rbacService.getSeniorityLevels(),
  });
  const { data: approvalLimits, isLoading: limitsLoading } = useQuery({
    queryKey: ['rbac-approval-limits'],
    queryFn: () => rbacService.getApprovalLimits(),
  });
  const { data: departments, isLoading: departmentsLoading } = useQuery({
    queryKey: ['rbac-departments'],
    queryFn: () => rbacService.getDepartments(),
  });

  const permissionsByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (permissions ?? []).forEach((p: any) => {
      groups[p.category] = groups[p.category] ?? [];
      groups[p.category].push(p);
    });
    return groups;
  }, [permissions]);

  // ---------- Role dialog ----------
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleEditing, setRoleEditing] = useState<any>(null);
  const [roleForm, setRoleForm] = useState<{ name: string; description: string; permission_keys: string[] }>({
    name: '', description: '', permission_keys: [],
  });
  const [roleError, setRoleError] = useState('');

  const openRoleModal = (role?: any) => {
    setRoleEditing(role ?? null);
    setRoleForm(role
      ? { name: role.name, description: role.description ?? '', permission_keys: [...role.permission_keys] }
      : { name: '', description: '', permission_keys: [] });
    setRoleError('');
    setRoleModalOpen(true);
  };
  const closeRoleModal = () => { setRoleModalOpen(false); setRoleEditing(null); setRoleError(''); };

  const roleMutation = useMutation({
    mutationFn: (data: any) => roleEditing ? rbacService.updateRole(roleEditing.id, data) : rbacService.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      toast.success(roleEditing ? 'Role updated' : 'Role created');
      closeRoleModal();
    },
    onError: (e: any) => setRoleError(getErrorMessage(e, 'Failed to save role')),
  });

  const roleDeleteMutation = useMutation({
    mutationFn: (id: number) => rbacService.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      toast.success('Role deleted');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to delete role')),
  });

  const togglePermission = (key: string) => {
    setRoleForm((prev) => ({
      ...prev,
      permission_keys: prev.permission_keys.includes(key)
        ? prev.permission_keys.filter((k) => k !== key)
        : [...prev.permission_keys, key],
    }));
  };

  const toggleCategory = (keys: string[]) => {
    setRoleForm((prev) => {
      const allSelected = keys.every((k) => prev.permission_keys.includes(k));
      return {
        ...prev,
        permission_keys: allSelected
          ? prev.permission_keys.filter((k) => !keys.includes(k))
          : Array.from(new Set([...prev.permission_keys, ...keys])),
      };
    });
  };

  const submitRole = () => {
    setRoleError('');
    roleMutation.mutate({
      name: roleForm.name,
      description: roleForm.description || undefined,
      permission_keys: roleForm.permission_keys,
    });
  };

  // ---------- Seniority level dialog ----------
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [levelEditing, setLevelEditing] = useState<any>(null);
  const [levelForm, setLevelForm] = useState({ name: '', rank: '' });
  const [levelError, setLevelError] = useState('');

  const openLevelModal = (level?: any) => {
    setLevelEditing(level ?? null);
    setLevelForm(level ? { name: level.name, rank: String(level.rank) } : { name: '', rank: '' });
    setLevelError('');
    setLevelModalOpen(true);
  };
  const closeLevelModal = () => { setLevelModalOpen(false); setLevelEditing(null); setLevelError(''); };

  const levelMutation = useMutation({
    mutationFn: (data: any) => levelEditing
      ? rbacService.updateSeniorityLevel(levelEditing.id, data)
      : rbacService.createSeniorityLevel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-seniority-levels'] });
      toast.success(levelEditing ? 'Seniority level updated' : 'Seniority level created');
      closeLevelModal();
    },
    onError: (e: any) => setLevelError(getErrorMessage(e, 'Failed to save seniority level')),
  });

  const levelDeleteMutation = useMutation({
    mutationFn: (id: number) => rbacService.deleteSeniorityLevel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-seniority-levels'] });
      toast.success('Seniority level deleted');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to delete seniority level')),
  });

  const submitLevel = () => {
    setLevelError('');
    levelMutation.mutate({ name: levelForm.name, rank: Number(levelForm.rank) });
  };

  // ---------- Approval limit dialog ----------
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitForm, setLimitForm] = useState<{ role_id: string; seniority_level_id: string; permission_key: string; max_amount: string }>({
    role_id: '', seniority_level_id: '', permission_key: AMOUNT_LIMITED_PERMISSIONS[0], max_amount: '',
  });
  const [limitError, setLimitError] = useState('');

  const openLimitModal = () => {
    setLimitForm({ role_id: '', seniority_level_id: '', permission_key: AMOUNT_LIMITED_PERMISSIONS[0], max_amount: '' });
    setLimitError('');
    setLimitModalOpen(true);
  };
  const closeLimitModal = () => setLimitModalOpen(false);

  const limitMutation = useMutation({
    mutationFn: (data: any) => rbacService.createApprovalLimit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-approval-limits'] });
      toast.success('Approval limit created');
      closeLimitModal();
    },
    onError: (e: any) => setLimitError(getErrorMessage(e, 'Failed to save approval limit')),
  });

  const limitDeleteMutation = useMutation({
    mutationFn: (id: number) => rbacService.deleteApprovalLimit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-approval-limits'] });
      toast.success('Approval limit deleted - now unlimited for that combination');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to delete approval limit')),
  });

  const submitLimit = () => {
    setLimitError('');
    if (!limitForm.role_id && !limitForm.seniority_level_id) {
      setLimitError('Pick a role, a seniority level, or both');
      return;
    }
    limitMutation.mutate({
      role_id: limitForm.role_id ? Number(limitForm.role_id) : null,
      seniority_level_id: limitForm.seniority_level_id ? Number(limitForm.seniority_level_id) : null,
      permission_key: limitForm.permission_key,
      max_amount: Number(limitForm.max_amount),
    });
  };

  // ---------- Department dialog ----------
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptEditing, setDeptEditing] = useState<any>(null);
  const [deptForm, setDeptForm] = useState({ name: '' });
  const [deptError, setDeptError] = useState('');

  const openDeptModal = (dept?: any) => {
    setDeptEditing(dept ?? null);
    setDeptForm({ name: dept?.name ?? '' });
    setDeptError('');
    setDeptModalOpen(true);
  };
  const closeDeptModal = () => { setDeptModalOpen(false); setDeptEditing(null); setDeptError(''); };

  const deptMutation = useMutation({
    mutationFn: (data: { name: string }) => deptEditing
      ? rbacService.updateDepartment(deptEditing.id, data)
      : rbacService.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-departments'] });
      toast.success(deptEditing ? 'Department renamed' : 'Department created');
      closeDeptModal();
    },
    onError: (e: any) => setDeptError(getErrorMessage(e, 'Failed to save department')),
  });

  const deptDeleteMutation = useMutation({
    mutationFn: (id: number) => rbacService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac-departments'] });
      toast.success('Department deleted');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to delete department')),
  });

  const submitDept = () => {
    setDeptError('');
    deptMutation.mutate({ name: deptForm.name });
  };

  const loading = permsLoading || rolesLoading || seniorityLoading || limitsLoading || departmentsLoading;
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>Roles & Permissions</Typography>
        <Typography variant="body2" color="textSecondary">
          Manage designations, their permission matrix, seniority levels, and approval limits
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Roles & Permissions" />
        <Tab label="Seniority Levels" />
        <Tab label="Approval Limits" />
        <Tab label="Departments" />
      </Tabs>

      {/* ============ ROLES TAB ============ */}
      <TabPanel value={tab} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openRoleModal()}>
            New Role
          </Button>
        </Box>
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell align="right"><strong>Permissions</strong></TableCell>
                <TableCell align="right"><strong>Users</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(roles ?? []).map((role: any) => (
                <TableRow key={role.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{role.name}</TableCell>
                  <TableCell>{role.description || '-'}</TableCell>
                  <TableCell>
                    <Chip label={role.is_system ? 'System' : 'Custom'} size="small" color={role.is_system ? 'default' : 'primary'} variant={role.is_system ? 'outlined' : 'filled'} />
                  </TableCell>
                  <TableCell align="right">{role.permission_keys.length}</TableCell>
                  <TableCell align="right">{role.user_count}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openRoleModal(role)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                    {!role.is_system && (
                      <IconButton
                        size="small"
                        color="error"
                        title={role.user_count > 0 ? 'Reassign users before deleting' : 'Delete'}
                        disabled={role.user_count > 0}
                        onClick={() => roleDeleteMutation.mutate(role.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* ============ SENIORITY TAB ============ */}
      <TabPanel value={tab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openLevelModal()}>
            New Seniority Level
          </Button>
        </Box>
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell align="right"><strong>Rank</strong></TableCell>
                <TableCell align="right"><strong>Employees</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(seniorityLevels ?? []).map((level: any) => (
                <TableRow key={level.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{level.name}</TableCell>
                  <TableCell align="right">{level.rank}</TableCell>
                  <TableCell align="right">{level.employee_count}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openLevelModal(level)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      title={level.employee_count > 0 ? 'Reassign employees before deleting' : 'Delete'}
                      disabled={level.employee_count > 0}
                      onClick={() => levelDeleteMutation.mutate(level.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* ============ APPROVAL LIMITS TAB ============ */}
      <TabPanel value={tab} index={2}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Sets a maximum amount for finance approvals (vouchers, invoices, expense claims, budgets). The most
          specific match wins: role + seniority beats either alone, which beats neither. A combination with no
          limit row is unlimited.
        </Alert>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openLimitModal}>
            New Approval Limit
          </Button>
        </Box>
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Seniority</strong></TableCell>
                <TableCell><strong>Permission</strong></TableCell>
                <TableCell align="right"><strong>Max Amount</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(approvalLimits ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No approval limits set - all approvals are unlimited</Typography></TableCell></TableRow>
              ) : (
                approvalLimits.map((limit: any) => (
                  <TableRow key={limit.id} hover>
                    <TableCell>{limit.role_name || <Typography component="span" color="textSecondary">Any</Typography>}</TableCell>
                    <TableCell>{limit.seniority_level_name || <Typography component="span" color="textSecondary">Any</Typography>}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{limit.permission_key}</TableCell>
                    <TableCell align="right">Rs. {Number(limit.max_amount).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => limitDeleteMutation.mutate(limit.id)} title="Delete">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* ============ DEPARTMENTS TAB ============ */}
      <TabPanel value={tab} index={3}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openDeptModal()}>
            New Department
          </Button>
        </Box>
        <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell align="right"><strong>Employees</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(departments ?? []).map((dept: any) => (
                <TableRow key={dept.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{dept.name}</TableCell>
                  <TableCell align="right">{dept.employee_count}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openDeptModal(dept)} title="Rename"><EditIcon fontSize="small" /></IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      title={dept.employee_count > 0 ? 'Reassign employees before deleting' : 'Delete'}
                      disabled={dept.employee_count > 0}
                      onClick={() => deptDeleteMutation.mutate(dept.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* ============ Role Dialog ============ */}
      <Dialog open={roleModalOpen} onClose={closeRoleModal} maxWidth="sm" fullWidth>
        <DialogTitle>{roleEditing ? `Edit Role - ${roleEditing.name}` : 'New Role'}</DialogTitle>
        <DialogContent>
          {roleError && <Alert severity="error" sx={{ mb: 2 }}>{roleError}</Alert>}
          <TextField
            fullWidth label="Name" value={roleForm.name} margin="normal" size="small"
            disabled={roleEditing?.is_system}
            helperText={roleEditing?.is_system ? 'System roles cannot be renamed' : ''}
            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
            placeholder="e.g. Senior Editor"
          />
          <TextField
            fullWidth label="Description (optional)" value={roleForm.description} margin="normal" size="small"
            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
          />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Permissions</Typography>
          {Object.entries(permissionsByCategory).map(([category, perms]) => {
            const keys = perms.map((p) => p.key);
            const allSelected = keys.every((k) => roleForm.permission_keys.includes(k));
            const someSelected = keys.some((k) => roleForm.permission_keys.includes(k));
            return (
              <Box key={category} sx={{ mb: 1.5 }}>
                <FormControlLabel
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{category}</Typography>}
                  control={
                    <Checkbox
                      size="small"
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onChange={() => toggleCategory(keys)}
                    />
                  }
                />
                <FormGroup sx={{ pl: 3 }}>
                  {perms.map((p) => (
                    <FormControlLabel
                      key={p.key}
                      label={<Typography variant="body2">{p.description}</Typography>}
                      control={
                        <Checkbox
                          size="small"
                          checked={roleForm.permission_keys.includes(p.key)}
                          onChange={() => togglePermission(p.key)}
                        />
                      }
                    />
                  ))}
                </FormGroup>
              </Box>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRoleModal}>Cancel</Button>
          <Button variant="contained" onClick={submitRole} disabled={!roleForm.name || roleMutation.isPending}>
            {roleMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============ Seniority Level Dialog ============ */}
      <Dialog open={levelModalOpen} onClose={closeLevelModal} maxWidth="xs" fullWidth>
        <DialogTitle>{levelEditing ? 'Edit Seniority Level' : 'New Seniority Level'}</DialogTitle>
        <DialogContent>
          {levelError && <Alert severity="error" sx={{ mb: 2 }}>{levelError}</Alert>}
          <TextField fullWidth label="Name" value={levelForm.name} margin="normal" size="small" placeholder="e.g. Senior" onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} />
          <TextField
            fullWidth label="Rank" type="number" value={levelForm.rank} margin="normal" size="small"
            helperText="Higher rank = more senior. Used to order levels, e.g. Junior=1, Mid=2, Senior=3, Lead=4."
            onChange={(e) => setLevelForm({ ...levelForm, rank: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeLevelModal}>Cancel</Button>
          <Button variant="contained" onClick={submitLevel} disabled={!levelForm.name || levelForm.rank === '' || levelMutation.isPending}>
            {levelMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============ Approval Limit Dialog ============ */}
      <Dialog open={limitModalOpen} onClose={closeLimitModal} maxWidth="xs" fullWidth>
        <DialogTitle>New Approval Limit</DialogTitle>
        <DialogContent>
          {limitError && <Alert severity="error" sx={{ mb: 2 }}>{limitError}</Alert>}
          <TextField
            select fullWidth label="Role (optional)" value={limitForm.role_id} margin="normal" size="small"
            onChange={(e) => setLimitForm({ ...limitForm, role_id: e.target.value })}
          >
            <MenuItem value="">Any role</MenuItem>
            {(roles ?? []).map((r: any) => <MenuItem key={r.id} value={String(r.id)}>{r.name}</MenuItem>)}
          </TextField>
          <TextField
            select fullWidth label="Seniority level (optional)" value={limitForm.seniority_level_id} margin="normal" size="small"
            onChange={(e) => setLimitForm({ ...limitForm, seniority_level_id: e.target.value })}
          >
            <MenuItem value="">Any seniority</MenuItem>
            {(seniorityLevels ?? []).map((l: any) => <MenuItem key={l.id} value={String(l.id)}>{l.name}</MenuItem>)}
          </TextField>
          <TextField
            select fullWidth label="Permission" value={limitForm.permission_key} margin="normal" size="small"
            onChange={(e) => setLimitForm({ ...limitForm, permission_key: e.target.value })}
          >
            {AMOUNT_LIMITED_PERMISSIONS.map((key) => <MenuItem key={key} value={key}>{key}</MenuItem>)}
          </TextField>
          <TextField
            fullWidth label="Max Amount" type="number" value={limitForm.max_amount} margin="normal" size="small"
            onChange={(e) => setLimitForm({ ...limitForm, max_amount: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeLimitModal}>Cancel</Button>
          <Button variant="contained" onClick={submitLimit} disabled={!limitForm.max_amount || limitMutation.isPending}>
            {limitMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============ Department Dialog ============ */}
      <Dialog open={deptModalOpen} onClose={closeDeptModal} maxWidth="xs" fullWidth>
        <DialogTitle>{deptEditing ? 'Rename Department' : 'New Department'}</DialogTitle>
        <DialogContent>
          {deptError && <Alert severity="error" sx={{ mb: 2 }}>{deptError}</Alert>}
          <TextField
            fullWidth label="Name" value={deptForm.name} margin="normal" size="small"
            placeholder="e.g. Human Resources"
            helperText={deptEditing ? 'Renaming updates every employee currently in this department' : ''}
            onChange={(e) => setDeptForm({ name: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeptModal}>Cancel</Button>
          <Button variant="contained" onClick={submitDept} disabled={!deptForm.name.trim() || deptMutation.isPending}>
            {deptMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RolesPermissions;
