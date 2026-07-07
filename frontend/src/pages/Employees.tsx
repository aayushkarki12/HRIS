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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PersonOff as PersonOffIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { employeeService, getErrorMessage } from '../services/api';
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
  joining_date: z.string().min(1, 'Join date is required'),
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
    setValue('joining_date', employee.joining_date.split('T')[0]);
    setIsModalOpen(true);
    setError('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setEditingId(null);
    setError('');
  };

  const colCount = isAdmin ? 7 : 6;

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
                  <TableCell>Status</TableCell>
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
                        <Chip
                          label={employee.is_active ? 'Active' : 'Inactive'}
                          color={employee.is_active ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleEdit(employee)} color="primary">
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Deactivate">
                              <IconButton
                                size="small"
                                onClick={() => setDeleteTarget(employee)}
                                color="error"
                                disabled={!employee.is_active}
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
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
          <DialogTitle sx={{ pb: 1 }}>
            {editingId ? 'Edit Employee' : 'Add Employee'}
          </DialogTitle>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogContent sx={{ pt: 1 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField
                  fullWidth
                  label="Employee ID"
                  {...register('employee_id')}
                  error={!!errors.employee_id}
                  helperText={errors.employee_id?.message}
                  size="small"
                  disabled={!!editingId}
                  sx={{ gridColumn: '1 / -1' }}
                />
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
                  label="Department"
                  {...register('department')}
                  error={!!errors.department}
                  helperText={errors.department?.message}
                  size="small"
                />
                <TextField
                  fullWidth
                  label="Position"
                  {...register('position')}
                  error={!!errors.position}
                  helperText={errors.position?.message}
                  size="small"
                />
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
              They will no longer be able to access the system.
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
      </Box>
    </motion.div>
  );
};

export default Employees;
