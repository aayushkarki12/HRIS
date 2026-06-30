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
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as AccountIcon,
} from '@mui/icons-material';
import { accountingService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset', color: '#2196f3' },
  { value: 'liability', label: 'Liability', color: '#f44336' },
  { value: 'equity', label: 'Equity', color: '#9c27b0' },
  { value: 'income', label: 'Income', color: '#4caf50' },
  { value: 'expense', label: 'Expense', color: '#ff9800' },
];

const getTypeColor = (type: string): string => {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.color || '#757575';
};

const ChartOfAccounts: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: '',
    parent_id: '',
    description: '',
  });

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingService.getAccounts(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => accountingService.createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account created successfully');
      handleCloseModal();
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to create account';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => accountingService.updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account updated successfully');
      handleCloseModal();
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to update account';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountingService.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account deactivated successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to deactivate account';
      toast.error(errorMsg);
    },
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setFormData({ code: '', name: '', account_type: '', parent_id: '', description: '' });
    setError('');
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      parent_id: account.parent_id || '',
      description: account.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    setError('');
    const submitData: any = {
      code: formData.code,
      name: formData.name,
      account_type: formData.account_type,
      description: formData.description || null,
      parent_id: formData.parent_id ? Number(formData.parent_id) : null,
    };

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDelete = (account: any) => {
    if (window.confirm(`Are you sure you want to deactivate account "${account.code} - ${account.name}"?`)) {
      deleteMutation.mutate(account.id);
    }
  };

  const filteredAccounts = accounts?.filter((a: any) =>
    selectedType === 'all' || a.account_type === selectedType
  );

  const parentAccounts = accounts?.filter((a: any) => a.is_active) || [];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
            Chart of Accounts
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage your organization's accounts
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsModalOpen(true)}
            >
              Add Account
            </Button>
          )}
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 4 }}>
        {ACCOUNT_TYPES.map((type) => {
          const count = accounts?.filter((a: any) => a.account_type === type.value && a.is_active).length || 0;
          return (
            <Box key={type.value} sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(20% - 16px)' }, minWidth: '140px' }}>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: selectedType === type.value ? `2px solid ${type.color}` : '2px solid transparent',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: '0 4px 15px rgba(0,0,0,0.1)' },
                }}
                onClick={() => setSelectedType(selectedType === type.value ? 'all' : type.value)}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                  {type.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: type.color }}>
                  {count}
                </Typography>
              </Paper>
            </Box>
          );
        })}
      </Box>

      {/* Filter Chips */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label="All"
          onClick={() => setSelectedType('all')}
          color={selectedType === 'all' ? 'primary' : 'default'}
          variant={selectedType === 'all' ? 'filled' : 'outlined'}
        />
        {ACCOUNT_TYPES.map((type) => (
          <Chip
            key={type.value}
            label={type.label}
            onClick={() => setSelectedType(type.value)}
            color={selectedType === type.value ? 'primary' : 'default'}
            variant={selectedType === type.value ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {/* Accounts Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Parent</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAccounts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} align="center" sx={{ py: 4 }}>
                  <AccountIcon sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                  <Typography color="textSecondary">No accounts found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredAccounts?.map((account: any) => {
                const parentAccount = accounts?.find((a: any) => a.id === account.parent_id);
                return (
                  <TableRow key={account.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {account.code}
                      </Typography>
                    </TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={account.account_type}
                        size="small"
                        sx={{
                          bgcolor: `${getTypeColor(account.account_type)}15`,
                          color: getTypeColor(account.account_type),
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {parentAccount ? `${parentAccount.code} - ${parentAccount.name}` : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={account.is_active ? 'Active' : 'Inactive'}
                        color={account.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        <IconButton size="small" color="primary" onClick={() => handleEdit(account)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {account.is_active && (
                          <IconButton size="small" color="error" onClick={() => handleDelete(account)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAccount ? 'Edit Account' : 'Create Account'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Account Code"
            name="code"
            value={formData.code}
            onChange={handleFormChange}
            margin="normal"
            size="small"
            placeholder="e.g. 1000, 2100, 4000"
          />
          <TextField
            fullWidth
            label="Account Name"
            name="name"
            value={formData.name}
            onChange={handleFormChange}
            margin="normal"
            size="small"
            placeholder="e.g. Cash, Accounts Payable"
          />
          <TextField
            fullWidth
            select
            label="Account Type"
            name="account_type"
            value={formData.account_type}
            onChange={handleFormChange}
            margin="normal"
            size="small"
          >
            <MenuItem value="">Select Type</MenuItem>
            {ACCOUNT_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            select
            label="Parent Account (Optional)"
            name="parent_id"
            value={formData.parent_id}
            onChange={handleFormChange}
            margin="normal"
            size="small"
          >
            <MenuItem value="">No Parent</MenuItem>
            {parentAccounts
              .filter((a: any) => a.id !== editingAccount?.id)
              .map((account: any) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleFormChange}
            margin="normal"
            size="small"
            multiline
            rows={3}
            placeholder="Optional description"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.code || !formData.name || !formData.account_type || createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : editingAccount
              ? 'Update Account'
              : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChartOfAccounts;
