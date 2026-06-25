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
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
} from '@mui/icons-material';
import { assignmentService, employeeService, resourceService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const assignmentSchema = z.object({
  employee_id: z.number().min(1, 'Employee is required'),
  resource_id: z.number().min(1, 'Resource is required'),
  project_id: z.number().min(1, 'Project is required'),
  assigned_date: z.string().optional(),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

const Assignments: React.FC = () => {
  const { isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: assignments, isLoading, refetch } = useQuery({
    queryKey: ['assignments'],
    queryFn: assignmentService.getAll,
    enabled: isAdmin,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
    enabled: isAdmin,
  });

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    queryFn: resourceService.getAll,
    enabled: isAdmin,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
    enabled: isAdmin,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      assigned_date: new Date().toISOString().split('T')[0],
    },
  });

  const createMutation = useMutation({
    mutationFn: assignmentService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource assigned successfully');
      setIsModalOpen(false);
      reset();
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to assign resource';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const returnMutation = useMutation({
    mutationFn: assignmentService.return,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource returned successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to return resource';
      toast.error(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: assignmentService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Assignment deleted successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to delete assignment';
      toast.error(errorMsg);
    },
  });

  const onSubmit = (data: AssignmentFormData) => {
    setError('');
    createMutation.mutate(data);
  };

  const handleReturn = (id: number) => {
    if (window.confirm('Are you sure you want to return this resource?')) {
      returnMutation.mutate(id);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setError('');
  };

  if (!isAdmin) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Card sx={{ maxWidth: 500, p: 3, textAlign: 'center' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom color="error">
              Access Denied
            </Typography>
            <Typography variant="body1" color="textSecondary">
              You don't have permission to view this page.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

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
          Resource Assignments
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
          >
            Assign Resource
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Employee</strong></TableCell>
              <TableCell><strong>Resource</strong></TableCell>
              <TableCell><strong>Project</strong></TableCell>
              <TableCell><strong>Assigned Date</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assignments && assignments.length > 0 ? (
              assignments.map((assignment: any) => (
                <TableRow key={assignment.id} hover>
                  <TableCell>
                    {assignment.employee?.first_name} {assignment.employee?.last_name}
                  </TableCell>
                  <TableCell>{assignment.resource?.name}</TableCell>
                  <TableCell>{assignment.project?.name}</TableCell>
                  <TableCell>
                    {assignment.assigned_date ? new Date(assignment.assigned_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={assignment.status}
                      color={assignment.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {assignment.status === 'active' && (
                      <IconButton
                        size="small"
                        onClick={() => handleReturn(assignment.id)}
                        color="primary"
                        title="Return Resource"
                      >
                        <ReplyIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(assignment.id)}
                      color="error"
                      title="Delete Assignment"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="textSecondary" sx={{ py: 4 }}>
                    No assignments found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Resource</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              select
              label="Employee"
              {...register('employee_id', { valueAsNumber: true })}
              error={!!errors.employee_id}
              helperText={errors.employee_id?.message}
              margin="normal"
              size="small"
            >
              <MenuItem value="">Select Employee</MenuItem>
              {employees?.map((emp: any) => (
                <MenuItem key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              select
              label="Resource"
              {...register('resource_id', { valueAsNumber: true })}
              error={!!errors.resource_id}
              helperText={errors.resource_id?.message}
              margin="normal"
              size="small"
            >
              <MenuItem value="">Select Resource</MenuItem>
              {resources?.filter((r: any) => r.status === 'available').map((resource: any) => (
                <MenuItem key={resource.id} value={resource.id}>
                  {resource.name} (SN: {resource.serial_number})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              select
              label="Project"
              {...register('project_id', { valueAsNumber: true })}
              error={!!errors.project_id}
              helperText={errors.project_id?.message}
              margin="normal"
              size="small"
            >
              <MenuItem value="">Select Project</MenuItem>
              {projects?.map((project: any) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Assigned Date"
              type="date"
              {...register('assigned_date')}
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
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Assignments;