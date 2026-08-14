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
  TextField,
  CircularProgress,
  MenuItem,
  Select,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Block as DeactivateIcon,
  CheckCircle as ActivateIcon,
  LockReset as LockResetIcon,
  ContentCopy as CopyIcon,
  LocationOn as LocationIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { userService, rbacService, workLocationService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'default'> = {
  admin: 'error',
  manager: 'warning',
  user: 'default',
};

const Users: React.FC = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [pendingRoleChange, setPendingRoleChange] = useState<{ id: number; name: string; from: string; to: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: number; username: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resultPassword, setResultPassword] = useState<string | null>(null);
  const [sitesTarget, setSitesTarget] = useState<{ id: number; name: string } | null>(null);
  const [siteToAdd, setSiteToAdd] = useState<{ id: number; name: string; depth: number } | null>(null);

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['users', search],
    queryFn: () => userService.getAll(search || undefined),
    enabled: isAdmin,
  });

  const { data: roles } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => rbacService.getRoles(),
    enabled: isAdmin,
  });

  const { data: workLocationsTree } = useQuery({
    queryKey: ['workLocationsTree'],
    queryFn: workLocationService.getTree,
    enabled: isAdmin,
  });
  const flatSites = useMemo(() => {
    const out: { id: number; name: string; depth: number }[] = [];
    (workLocationsTree ?? []).forEach((loc: any) => {
      out.push({ id: loc.id, name: loc.name, depth: 0 });
      (loc.children ?? []).forEach((child: any) => out.push({ id: child.id, name: child.name, depth: 1 }));
    });
    return out;
  }, [workLocationsTree]);

  const { data: siteAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-site-assignments', sitesTarget?.id],
    queryFn: () => userService.getSiteAssignments(sitesTarget!.id),
    enabled: !!sitesTarget,
  });
  const activeAssignments = (siteAssignments ?? []).filter((a: any) => a.is_active);

  const addSiteMutation = useMutation({
    mutationFn: ({ userId, workLocationId }: { userId: number; workLocationId: number }) =>
      userService.addSiteAssignment(userId, workLocationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-site-assignments', sitesTarget?.id] });
      setSiteToAdd(null);
      toast.success('Site assigned');
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to assign site'),
  });

  const removeSiteMutation = useMutation({
    mutationFn: ({ userId, assignmentId }: { userId: number; assignmentId: number }) =>
      userService.removeSiteAssignment(userId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-site-assignments', sitesTarget?.id] });
      toast.success('Site unassigned');
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to unassign site'),
  });

  const roleIdMutation = useMutation({
    mutationFn: ({ id, role_id }: { id: number; role_id: number }) => userService.updateRoleId(id, role_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Designation updated');
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to update designation'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: 'admin' | 'manager' | 'user' }) => userService.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role updated');
      setPendingRoleChange(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update role');
      setPendingRoleChange(null);
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => userService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User activated');
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to activate user'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => userService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to deactivate user'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => userService.adminResetPassword(id, password),
    onSuccess: (_data, variables) => {
      toast.success('Password reset');
      setResultPassword(variables.password);
    },
    onError: (error: any) => toast.error(error.response?.data?.detail || 'Failed to reset password'),
  });

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(pwd);
  };

  const closeResetDialog = () => {
    setResetTarget(null);
    setNewPassword('');
    setResultPassword(null);
  };

  if (!isAdmin) {
    return <AccessDenied />;
  }

  const handleRoleSelect = (u: any, newRole: string) => {
    if (newRole === u.role) return;
    setPendingRoleChange({ id: u.id, name: `${u.first_name} ${u.last_name}`, from: u.role, to: newRole });
  };

  const confirmRoleChange = () => {
    if (pendingRoleChange) {
      roleMutation.mutate({ id: pendingRoleChange.id, role: pendingRoleChange.to as 'admin' | 'manager' | 'user' });
    }
  };

  if (isLoading) {
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
          <Typography variant="h4" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, color: '#0F172A' }}>Users & Roles</Typography>
          <Typography variant="body2" color="textSecondary">
            Manage who can access manager/admin-only features like Inventory and Audit Trail
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>Refresh</Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name, username, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 320 }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F1F5F9' }}>
              <TableCell><strong>Username</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Role</strong></TableCell>
              <TableCell><strong>Designation</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(!users || users.length === 0) ? (
              <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No users found</Typography></TableCell></TableRow>
            ) : users.map((u: any) => {
              const isSelf = u.id === currentUser?.id;
              const userRole = (roles ?? []).find((r: any) => r.id === u.role_id);
              const isSiteScoped = userRole?.scope === 'site';
              return (
                <TableRow key={u.id} hover>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.first_name} {u.last_name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={u.role}
                      onChange={(e) => handleRoleSelect(u, e.target.value)}
                      disabled={isSelf || roleMutation.isPending}
                      sx={{ minWidth: 130 }}
                      renderValue={(value) => <Chip label={value as string} color={ROLE_COLORS[value as string]} size="small" sx={{ textTransform: 'capitalize' }} />}
                    >
                      <MenuItem value="user">User</MenuItem>
                      <MenuItem value="manager">Manager</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                    {isSelf && (
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>
                        Can't change your own role
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={u.role_id ?? ''}
                      displayEmpty
                      onChange={(e) => roleIdMutation.mutate({ id: u.id, role_id: Number(e.target.value) })}
                      disabled={roleIdMutation.isPending}
                      sx={{ minWidth: 160 }}
                    >
                      <MenuItem value="" disabled>Unassigned</MenuItem>
                      {(roles ?? []).map((r: any) => (
                        <MenuItem key={r.id} value={r.id}>{r.name}{r.scope === 'site' ? ' (site-scoped)' : ''}</MenuItem>
                      ))}
                    </Select>
                    {isSiteScoped && (
                      <Button
                        size="small"
                        startIcon={<LocationIcon fontSize="small" />}
                        onClick={() => setSitesTarget({ id: u.id, name: `${u.first_name} ${u.last_name}` })}
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        Manage Sites
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={u.is_active ? 'Active' : 'Inactive'} color={u.is_active ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => setResetTarget({ id: u.id, username: u.username })} title="Reset Password">
                      <LockResetIcon fontSize="small" />
                    </IconButton>
                    {!isSelf && (
                      u.is_active ? (
                        <IconButton size="small" color="error" onClick={() => { if (window.confirm(`Deactivate ${u.username}?`)) deactivateMutation.mutate(u.id); }} title="Deactivate">
                          <DeactivateIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <IconButton size="small" color="success" onClick={() => activateMutation.mutate(u.id)} title="Activate">
                          <ActivateIcon fontSize="small" />
                        </IconButton>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!pendingRoleChange} onClose={() => setPendingRoleChange(null)}>
        <DialogTitle>Confirm Role Change</DialogTitle>
        <DialogContent>
          {pendingRoleChange && (
            <Alert severity="warning">
              Change <strong>{pendingRoleChange.name}</strong>'s role from <strong>{pendingRoleChange.from}</strong> to <strong>{pendingRoleChange.to}</strong>?
              {pendingRoleChange.to === 'admin' && ' This grants full system access.'}
              {pendingRoleChange.to === 'manager' && ' This grants access to Inventory and other manager-only areas.'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPendingRoleChange(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={confirmRoleChange} disabled={roleMutation.isPending}>
            {roleMutation.isPending ? 'Updating...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!resetTarget} onClose={closeResetDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password{resetTarget ? ` - ${resetTarget.username}` : ''}</DialogTitle>
        <DialogContent>
          {resultPassword ? (
            <Box sx={{ mt: 1 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Password reset. Share this with {resetTarget?.username} securely - it won't be shown again.
              </Alert>
              <TextField
                fullWidth
                value={resultPassword}
                slotProps={{
                  input: {
                    readOnly: true,
                    endAdornment: (
                      <IconButton onClick={() => { navigator.clipboard.writeText(resultPassword); toast.success('Copied'); }} size="small">
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    ),
                  },
                }}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This sets a new password without needing the old one, and logs the user out of all active sessions.
              </Alert>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="At least 8 characters, with uppercase, lowercase, and a number"
                />
                <Button onClick={generatePassword} variant="outlined" sx={{ whiteSpace: 'nowrap' }}>Generate</Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {resultPassword ? (
            <Button onClick={closeResetDialog} variant="contained">Done</Button>
          ) : (
            <>
              <Button onClick={closeResetDialog} color="inherit">Cancel</Button>
              <Button
                variant="contained"
                color="warning"
                disabled={!newPassword || resetPasswordMutation.isPending}
                onClick={() => resetTarget && resetPasswordMutation.mutate({ id: resetTarget.id, password: newPassword })}
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={!!sitesTarget} onClose={() => { setSitesTarget(null); setSiteToAdd(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Manage Sites{sitesTarget ? ` - ${sitesTarget.name}` : ''}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This role only sees employees and attendance at the site(s) assigned here.
          </Alert>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Autocomplete
              fullWidth
              size="small"
              options={flatSites.filter((s) => !activeAssignments.some((a: any) => a.work_location_id === s.id))}
              getOptionLabel={(s) => `${'    '.repeat(s.depth)}${s.name}`}
              value={siteToAdd}
              onChange={(_, value) => setSiteToAdd(value)}
              renderInput={(params) => <TextField {...params} label="Add a site" />}
            />
            <Button
              variant="contained"
              disabled={!siteToAdd || !sitesTarget || addSiteMutation.isPending}
              onClick={() => siteToAdd && sitesTarget && addSiteMutation.mutate({ userId: sitesTarget.id, workLocationId: siteToAdd.id })}
            >
              Add
            </Button>
          </Box>
          {assignmentsLoading ? (
            <CircularProgress size={20} />
          ) : activeAssignments.length === 0 ? (
            <Typography variant="body2" color="textSecondary">No sites assigned yet - this user sees nothing until at least one is added.</Typography>
          ) : (
            <List dense>
              {activeAssignments.map((a: any) => (
                <ListItem
                  key={a.id}
                  secondaryAction={
                    <IconButton
                      edge="end" size="small" color="error"
                      disabled={removeSiteMutation.isPending}
                      onClick={() => sitesTarget && removeSiteMutation.mutate({ userId: sitesTarget.id, assignmentId: a.id })}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText primary={a.work_location_name ?? `Location #${a.work_location_id}`} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSitesTarget(null); setSiteToAdd(null); }}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users;
