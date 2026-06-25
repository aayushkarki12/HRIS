import React, { useState } from 'react';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { employeeService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Employee } from '../types';

const employeeSchema = z.object({
  employee_id: z.string().min(2, 'Employee ID is required'),
  first_name: z.string().min(2, 'First name is required'),
  last_name: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number is required'),
  department: z.string().min(2, 'Department is required'),
  position: z.string().min(2, 'Position is required'),
  join_date: z.string().min(1, 'Join date is required'),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

const Employees: React.FC = () => {
  const { isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: employees, isLoading, refetch } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  const createMutation = useMutation({
    mutationFn: employeeService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created successfully');
      setIsModalOpen(false);
      reset();
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to create employee';
      toast.error(errorMsg);
      setError(errorMsg);
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
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to update employee';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: employeeService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee deactivated successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to deactivate employee';
      toast.error(errorMsg);
    },
  });

  const onSubmit = (data: EmployeeFormData) => {
    setError('');
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setValue('employee_id', employee.employee_id);
    setValue('first_name', employee.first_name);
    setValue('last_name', employee.last_name);
    setValue('email', employee.email);
    setValue('phone', employee.phone);
    setValue('department', employee.department);
    setValue('position', employee.position);
    setValue('join_date', employee.join_date.split('T')[0]);
    setIsModalOpen(true);
    setError('');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to deactivate this employee?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setEditingId(null);
    setError('');
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
        <Typography variant="h4" component="h1">
          Employees
        </Typography>
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
              Add Employee
            </Button>
          )}
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Employee ID</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Position</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {employees && employees.length > 0 ? (
              employees.map((employee: Employee) => (
                <TableRow key={employee.id} hover>
                  <TableCell>
                    <Chip label={employee.employee_id} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell>
                    <Chip
                      label={employee.is_active ? 'Active' : 'Inactive'}
                      color={employee.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <IconButton 
                        size="small" 
                        onClick={() => handleEdit(employee)} 
                        color="primary"
                        title="Edit"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => handleDelete(employee.id)} 
                        color="error"
                        title="Deactivate"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} align="center">
                  <Typography variant="body2" color="textSecondary" sx={{ py: 4 }}>
                    No employees found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Edit Employee' : 'Add Employee'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Employee ID"
              {...register('employee_id')}
              error={!!errors.employee_id}
              helperText={errors.employee_id?.message}
              margin="normal"
              size="small"
              disabled={!!editingId}
            />
            <TextField
              fullWidth
              label="First Name"
              {...register('first_name')}
              error={!!errors.first_name}
              helperText={errors.first_name?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Last Name"
              {...register('last_name')}
              error={!!errors.last_name}
              helperText={errors.last_name?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Phone"
              {...register('phone')}
              error={!!errors.phone}
              helperText={errors.phone?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Department"
              {...register('department')}
              error={!!errors.department}
              helperText={errors.department?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Position"
              {...register('position')}
              error={!!errors.position}
              helperText={errors.position?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Join Date"
              type="date"
              {...register('join_date')}
              error={!!errors.join_date}
              helperText={errors.join_date?.message}
              margin="normal"
              size="small"
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Employees;