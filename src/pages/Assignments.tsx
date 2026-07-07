import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
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
  Autocomplete,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
} from '@mui/icons-material';
import { assignmentService, employeeService, resourceService, projectService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const checkedIcon = <CheckBoxIcon fontSize="small" />;
const uncheckedIcon = <CheckBoxOutlineBlankIcon fontSize="small" />;

const assignmentSchema = z.object({
  employee_id: z.number().min(1, 'Employee is required'),
  resource_id: z.number().min(1, 'Resource is required'),
  project_ids: z.array(z.number()).min(1, 'Select at least one project'),
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

  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      assigned_date: new Date().toISOString().split('T')[0],
      project_ids: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AssignmentFormData) => {
      // project_ids is the full set of projects this assignment covers - the
      // backend stores all of them (assignment_projects) and keeps the first as
      // the legacy single project_id for backward compatibility.
      const assignment = await assignmentService.create({
        employee_id: data.employee_id,
        resource_id: data.resource_id,
        project_ids: data.project_ids,
        assigned_date: data.assigned_date,
      });
      // The employee should also be a team member of every selected project -
      // membership is independent of the resource assignment (see ProjectMember).
      await Promise.all(
        data.project_ids.map((projectId) =>
          projectService.addMember(projectId, data.employee_id).catch(() => {
            // Employee may already be a member of this project - that's fine.
          })
        )
      );
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      queryClient.invalidateQueries({ queryKey: ['project-members'] });
      toast.success('Resource assigned successfully');
      setIsModalOpen(false);
      reset();
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error, 'Failed to assign resource');
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
      const errorMsg = getErrorMessage(error, 'Failed to return resource');
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
      const errorMsg = getErrorMessage(error, 'Failed to delete assignment');
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
          <Typography variant="h4" component="h1">
            {isAdmin ? 'Resource Assignments' : 'My Resource Assignments'}
          </Typography>
          {!isAdmin && (
            <Typography variant="body2" color="textSecondary">
              Resources currently assigned to you
            </Typography>
          )}
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
              Assign Resource
            </Button>
          )}
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              {isAdmin && <TableCell><strong>Employee</strong></TableCell>}
              <TableCell><strong>Resource</strong></TableCell>
              <TableCell><strong>Project</strong></TableCell>
              <TableCell><strong>Assigned Date</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {assignments && assignments.length > 0 ? (
              assignments.map((assignment: any) => (
                <TableRow key={assignment.id} hover>
                  {isAdmin && (
                    <TableCell>
                      {assignment.employee?.first_name} {assignment.employee?.last_name}
                    </TableCell>
                  )}
                  <TableCell>{assignment.resource?.name}</TableCell>
                  <TableCell>
                    {assignment.projects?.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {assignment.projects.map((p: any) => (
                          <Chip key={p.id} label={p.name} size="small" variant="outlined" />
                        ))}
                      </Box>
                    ) : (
                      assignment.project?.name ?? '-'
                    )}
                  </TableCell>
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
                  {isAdmin && (
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
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 4} align="center">
                  <Typography variant="body2" color="textSecondary" sx={{ py: 4 }}>
                    {isAdmin ? 'No assignments found' : 'No resources assigned to you yet'}
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
            <Controller
              name="project_ids"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  size="small"
                  options={projects ?? []}
                  getOptionLabel={(project: any) => project.name}
                  isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
                  value={(projects ?? []).filter((p: any) => field.value?.includes(p.id))}
                  onChange={(_, value) => field.onChange(value.map((v: any) => v.id))}
                  disableCloseOnSelect
                  renderOption={(props, option, { selected }) => (
                    <li {...props} key={option.id}>
                      <Checkbox
                        icon={uncheckedIcon}
                        checkedIcon={checkedIcon}
                        checked={selected}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      {option.name}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Projects"
                      placeholder={field.value?.length ? '' : 'Select one or more projects'}
                      error={!!errors.project_ids}
                      helperText={errors.project_ids?.message ?? 'An employee can belong to multiple projects'}
                      margin="normal"
                    />
                  )}
                />
              )}
            />
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