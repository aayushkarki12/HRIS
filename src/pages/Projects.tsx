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
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  MenuItem,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const projectSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  status: z.enum(['active', 'completed', 'on-hold', 'planning', 'cancelled']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  budget: z.number().min(0, 'Budget must be greater than 0'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const Projects: React.FC = () => {
  const { isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  });

  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
      setIsModalOpen(false);
      reset();
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to create project';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => projectService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated successfully');
      setIsModalOpen(false);
      reset();
      setEditingId(null);
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to update project';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to delete project';
      toast.error(errorMsg);
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    setError('');
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (project: any) => {
    setEditingId(project.id);
    setValue('name', project.name);
    setValue('description', project.description);
    setValue('status', project.status);
    setValue('start_date', project.start_date.split('T')[0]);
    setValue('end_date', project.end_date ? project.end_date.split('T')[0] : '');
    setValue('budget', project.budget);
    setIsModalOpen(true);
    setError('');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    reset();
    setEditingId(null);
    setError('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'on-hold': return 'warning';
      case 'planning': return 'secondary';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <PlayArrowIcon sx={{ fontSize: 18 }} />;
      case 'completed': return <CheckCircleIcon sx={{ fontSize: 18 }} />;
      case 'on-hold': return <PauseIcon sx={{ fontSize: 18 }} />;
      case 'planning': return <ScheduleIcon sx={{ fontSize: 18 }} />;
      case 'cancelled': return <CancelIcon sx={{ fontSize: 18 }} />;
      default: return <CancelIcon sx={{ fontSize: 18 }} />;
    }
  };

  const getProgress = (status: string) => {
    switch (status) {
      case 'active': return 60;
      case 'completed': return 100;
      case 'on-hold': return 40;
      case 'planning': return 20;
      case 'cancelled': return 0;
      default: return 0;
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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: '#2c3e50' }}>
            Projects
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage your projects and track their progress
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh projects">
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </Tooltip>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsModalOpen(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
                },
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
            >
              Add Project
            </Button>
          )}
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f8ef' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#2ecc71' }}>
              {projects?.filter((p: any) => p.status === 'active').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">Active</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8edff' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#667eea' }}>
              {projects?.filter((p: any) => p.status === 'completed').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">Completed</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fef9e7' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#f39c12' }}>
              {projects?.filter((p: any) => p.status === 'on-hold').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">On Hold</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fde8e8' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#e74c3c' }}>
              {projects?.filter((p: any) => p.status === 'cancelled').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">Cancelled</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Projects Grid */}
      <Grid container spacing={3}>
        {projects && projects.length > 0 ? (
          projects.map((project: any) => (
            <Grid item xs={12} md={6} lg={4} key={project.id}>
              <Card 
                sx={{ 
                  borderRadius: 3,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
                  },
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mr: 2 }}>
                      {project.name}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(project.status)}
                      label={project.status}
                      color={getStatusColor(project.status)}
                      size="small"
                      sx={{ 
                        textTransform: 'capitalize',
                        flexShrink: 0,
                        ml: 1,
                      }}
                    />
                  </Box>

                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {project.description}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <MoneyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      Budget: ${project.budget?.toLocaleString() || 0}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" color="textSecondary">
                      {new Date(project.start_date).toLocaleDateString()}
                      {project.end_date && ` - ${new Date(project.end_date).toLocaleDateString()}`}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="textSecondary">Progress</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {getProgress(project.status)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={getProgress(project.status)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor: project.status === 'completed' ? '#2ecc71' : '#667eea',
                        },
                      }}
                    />
                  </Box>
                </CardContent>
                {isAdmin && (
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(project)}
                      sx={{ borderRadius: 2 }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(project.id)}
                      sx={{ borderRadius: 2 }}
                    >
                      Delete
                    </Button>
                  </CardActions>
                )}
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <Box sx={{ fontSize: 64, mb: 2 }}>📋</Box>
              <Typography variant="h6" sx={{ mb: 1 }}>No projects found</Typography>
              <Typography variant="body2" color="textSecondary">
                Start by creating your first project
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Modal */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Edit Project' : 'Add Project'}
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
              label="Name *"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description *"
              {...register('description')}
              error={!!errors.description}
              helperText={errors.description?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              select
              label="Status"
              {...register('status')}
              error={!!errors.status}
              helperText={errors.status?.message}
              margin="normal"
              size="small"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
              <MenuItem value="planning">Planning</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label="Start Date *"
              type="date"
              {...register('start_date')}
              error={!!errors.start_date}
              helperText={errors.start_date?.message}
              margin="normal"
              size="small"
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            <TextField
              fullWidth
              label="End Date"
              type="date"
              {...register('end_date')}
              margin="normal"
              size="small"
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            <TextField
              fullWidth
              label="Budget *"
              type="number"
              {...register('budget', { valueAsNumber: true })}
              error={!!errors.budget}
              helperText={errors.budget?.message}
              margin="normal"
              size="small"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Projects;