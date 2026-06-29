import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
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
  Check as CheckIcon,
  Close as CloseIcon,
  EventNote as EventIcon,
  CheckCircle as ApprovedIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { leaveService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Leaves: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const { data: leaveTypes } = useQuery({
    queryKey: ['leaveTypes'],
    queryFn: leaveService.getTypes,
  });

  const { data: leaves, isLoading, refetch } = useQuery({
    queryKey: ['leaves'],
    queryFn: leaveService.getMyLeaves,
  });

  const { data: pendingLeaves, refetch: refetchPending } = useQuery({
    queryKey: ['pendingLeaves'],
    queryFn: leaveService.getPending,
    enabled: isAdmin,
  });

  const { data: balances } = useQuery({
    queryKey: ['leaveBalances'],
    queryFn: leaveService.getBalance,
  });

  const createMutation = useMutation({
    mutationFn: () => leaveService.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      toast.success('Leave request submitted successfully');
      setIsModalOpen(false);
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to submit leave request';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: leaveService.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['pendingLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      toast.success('Leave approved successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to approve leave';
      toast.error(errorMsg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => leaveService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['pendingLeaves'] });
      toast.success('Leave rejected');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to reject leave';
      toast.error(errorMsg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: leaveService.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('Leave cancelled');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to cancel leave';
      toast.error(errorMsg);
    },
  });

  const handleSubmit = () => {
    setError('');
    createMutation.mutate();
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <ApprovedIcon fontSize="small" />;
      case 'pending': return <PendingIcon fontSize="small" />;
      case 'rejected': return <CloseIcon fontSize="small" />;
      case 'cancelled': return <CancelIcon fontSize="small" />;
      default: return <PendingIcon fontSize="small" />;
    }
  };

  const filteredLeaves = leaves?.filter((l: any) => 
    selectedStatus === 'all' || l.status === selectedStatus
  );

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
            Leave Management
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Request and manage your leaves
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              refetch();
              if (isAdmin) refetchPending();
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
          >
            Request Leave
          </Button>
        </Box>
      </Box>

      {/* Leave Balances */}
      <Typography variant="h6" sx={{ mb: 2 }}>My Leave Balances</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {balances?.map((balance: any) => (
          <Grid item xs={12} sm={6} md={4} key={balance.id}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <CardContent>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {balance.leave_type?.name || 'Leave'}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
                  {balance.remaining_days} days
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="caption" color="textSecondary">
                    Total: {balance.total_days}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Used: {balance.used_days}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Pending Requests (Admin Only) */}
      {isAdmin && pendingLeaves && pendingLeaves.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>Pending Requests</Typography>
          <TableContainer component={Paper} sx={{ mb: 4 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Leave Type</strong></TableCell>
                  <TableCell><strong>Dates</strong></TableCell>
                  <TableCell><strong>Days</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingLeaves.map((leave: any) => (
                  <TableRow key={leave.id} hover>
                    <TableCell>{leave.employee?.first_name} {leave.employee?.last_name}</TableCell>
                    <TableCell>{leave.leave_type?.name}</TableCell>
                    <TableCell>
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{leave.total_days} days</TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(leave.status)}
                        label={leave.status}
                        color={getStatusColor(leave.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => approveMutation.mutate(leave.id)}
                      >
                        <CheckIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          const reason = prompt('Enter rejection reason (optional):');
                          rejectMutation.mutate({ id: leave.id, reason: reason || undefined });
                        }}
                      >
                        <CloseIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* My Leaves */}
      <Typography variant="h6" sx={{ mb: 2 }}>My Leave History</Typography>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
          <Chip
            key={status}
            label={status.charAt(0).toUpperCase() + status.slice(1)}
            onClick={() => setSelectedStatus(status)}
            color={selectedStatus === status ? 'primary' : 'default'}
            variant={selectedStatus === status ? 'filled' : 'outlined'}
          />
        ))}
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Leave Type</strong></TableCell>
              <TableCell><strong>Dates</strong></TableCell>
              <TableCell><strong>Days</strong></TableCell>
              <TableCell><strong>Reason</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLeaves?.map((leave: any) => (
              <TableRow key={leave.id} hover>
                <TableCell>{leave.leave_type?.name}</TableCell>
                <TableCell>
                  {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                </TableCell>
                <TableCell>{leave.total_days} days</TableCell>
                <TableCell>{leave.reason || '-'}</TableCell>
                <TableCell>
                  <Chip
                    icon={getStatusIcon(leave.status)}
                    label={leave.status}
                    color={getStatusColor(leave.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  {leave.status === 'pending' && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => cancelMutation.mutate(leave.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Request Dialog */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Leave</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            select
            label="Leave Type"
            name="leave_type_id"
            value={formData.leave_type_id}
            onChange={handleFormChange}
            margin="normal"
            size="small"
          >
            <MenuItem value="">Select Leave Type</MenuItem>
            {leaveTypes?.map((type: any) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name} ({type.days_per_year} days/year)
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Start Date"
            type="date"
            name="start_date"
            value={formData.start_date}
            onChange={handleFormChange}
            margin="normal"
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth
            label="End Date"
            type="date"
            name="end_date"
            value={formData.end_date}
            onChange={handleFormChange}
            margin="normal"
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth
            label="Reason"
            name="reason"
            value={formData.reason}
            onChange={handleFormChange}
            margin="normal"
            size="small"
            multiline
            rows={3}
            placeholder="Optional reason for leave"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.leave_type_id || !formData.start_date || !formData.end_date || createMutation.isPending}
          >
            {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Leaves;