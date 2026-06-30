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
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Block as DeactivateIcon,
  CheckCircle as ActivateIcon,
  LockReset as LockResetIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { userService } from '../services/api';
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

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['users', search],
    queryFn: () => userService.getAll(search || undefined),
    enabled: isAdmin,
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
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>Users & Roles</Typography>
          <Typography variant="body2" color="textSecondary">
            Manage who can access manager/admin-only features like Accounting and Reports
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
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Username</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Role</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(!users || users.length === 0) ? (
              <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No users found</Typography></TableCell></TableRow>
            ) : users.map((u: any) => {
              const isSelf = u.id === currentUser?.id;
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
              {pendingRoleChange.to === 'admin' && ' This grants full system access including all accounting data.'}
              {pendingRoleChange.to === 'manager' && ' This grants access to Accounting, Invoices, and Reports.'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRoleChange(null)}>Cancel</Button>
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
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton onClick={() => { navigator.clipboard.writeText(resultPassword); toast.success('Copied'); }} size="small">
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  ),
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
              <Button onClick={closeResetDialog}>Cancel</Button>
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
    </Box>
  );
};

export default Users;
