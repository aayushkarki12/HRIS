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
  Avatar,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Computer as ComputerIcon,
  Laptop as LaptopIcon,
  Keyboard as KeyboardIcon,
  Mouse as MouseIcon,
  Devices as OtherIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Build as BuildIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { resourceService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const resourceSchema = z.object({
  asset_tag: z.string().optional(),
  name: z.string().min(2, 'Name is required'),
  type: z.enum(['laptop', 'monitor', 'keyboard', 'mouse', 'other']),
  model: z.string().optional(),
  serial_number: z.string().min(2, 'Serial number is required'),
  status: z.enum(['available', 'assigned', 'maintenance', 'repair']),
  purchase_date: z.string().optional(),
  warranty_until: z.string().optional(),
  notes: z.string().optional(),
});

type ResourceFormData = z.infer<typeof resourceSchema>;

const Resources: React.FC = () => {
  const theme = useTheme();
  const { isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: resources, isLoading, refetch } = useQuery({
    queryKey: ['resources'],
    queryFn: resourceService.getAll,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
  });

  const createMutation = useMutation({
    mutationFn: resourceService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource created successfully');
      setIsModalOpen(false);
      reset();
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to create resource';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => resourceService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource updated successfully');
      setIsModalOpen(false);
      reset();
      setEditingId(null);
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to update resource';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: resourceService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource deleted successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to delete resource';
      toast.error(errorMsg);
    },
  });

  const onSubmit = (data: ResourceFormData) => {
    setError('');
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (resource: any) => {
    setEditingId(resource.id);
    setValue('asset_tag', resource.asset_tag || '');
    setValue('name', resource.name);
    setValue('type', resource.type);
    setValue('model', resource.model || '');
    setValue('serial_number', resource.serial_number);
    setValue('status', resource.status);
    setValue('purchase_date', resource.purchase_date || '');
    setValue('warranty_until', resource.warranty_until || '');
    setValue('notes', resource.notes || '');
    setIsModalOpen(true);
    setError('');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this resource?')) {
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
      case 'available': return 'success';
      case 'assigned': return 'primary';
      case 'maintenance': return 'warning';
      case 'repair': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircleIcon sx={{ fontSize: 18 }} />;
      case 'assigned': return <ScheduleIcon sx={{ fontSize: 18 }} />;
      case 'maintenance': return <BuildIcon sx={{ fontSize: 18 }} />;
      case 'repair': return <RepairIcon sx={{ fontSize: 18 }} />;
      default: return <CancelIcon sx={{ fontSize: 18 }} />;
    }
  };

  const getTypeIcon = (type: string) => {
    const iconProps = { sx: { fontSize: 40 } };
    switch (type) {
      case 'laptop': return <LaptopIcon {...iconProps} />;
      case 'monitor': return <ComputerIcon {...iconProps} />;
      case 'keyboard': return <KeyboardIcon {...iconProps} />;
      case 'mouse': return <MouseIcon {...iconProps} />;
      default: return <OtherIcon {...iconProps} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'laptop': return '#667eea';
      case 'monitor': return '#2ecc71';
      case 'keyboard': return '#f39c12';
      case 'mouse': return '#3498db';
      default: return '#95a5a6';
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
            Resources
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage your company's IT assets and equipment
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh resources">
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
              Add Resource
            </Button>
          )}
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f8ef' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#2ecc71' }}>
              {resources?.filter((r: any) => r.status === 'available').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">Available</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8edff' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#667eea' }}>
              {resources?.filter((r: any) => r.status === 'assigned').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">Assigned</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fef9e7' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#f39c12' }}>
              {resources?.filter((r: any) => r.status === 'maintenance').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">Maintenance</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fde8e8' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#e74c3c' }}>
              {resources?.filter((r: any) => r.status === 'repair').length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">Repair</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Resources Grid */}
      <Grid container spacing={3}>
        {resources && resources.length > 0 ? (
          resources.map((resource: any) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={resource.id}>
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        bgcolor: `${getTypeColor(resource.type)}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: getTypeColor(resource.type),
                      }}
                    >
                      {getTypeIcon(resource.type)}
                    </Box>
                    <Chip
                      icon={getStatusIcon(resource.status)}
                      label={resource.status}
                      color={getStatusColor(resource.status)}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {resource.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    Type: {resource.type}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    SN: {resource.serial_number}
                  </Typography>
                  {resource.asset_tag && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      Asset: {resource.asset_tag}
                    </Typography>
                  )}
                </CardContent>
                {isAdmin && (
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(resource)}
                      sx={{ borderRadius: 2 }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(resource.id)}
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
              <Box sx={{ fontSize: 64, mb: 2 }}>📦</Box>
              <Typography variant="h6" sx={{ mb: 1 }}>No resources found</Typography>
              <Typography variant="body2" color="textSecondary">
                Start by adding your first resource
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Modal */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? 'Edit Resource' : 'Add Resource'}
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
              label="Asset Tag"
              {...register('asset_tag')}
              error={!!errors.asset_tag}
              helperText={errors.asset_tag?.message}
              margin="normal"
              size="small"
            />
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
              select
              label="Type *"
              {...register('type')}
              error={!!errors.type}
              helperText={errors.type?.message}
              margin="normal"
              size="small"
            >
              <MenuItem value="laptop">Laptop</MenuItem>
              <MenuItem value="monitor">Monitor</MenuItem>
              <MenuItem value="keyboard">Keyboard</MenuItem>
              <MenuItem value="mouse">Mouse</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label="Model"
              {...register('model')}
              error={!!errors.model}
              helperText={errors.model?.message}
              margin="normal"
              size="small"
            />
            <TextField
              fullWidth
              label="Serial Number *"
              {...register('serial_number')}
              error={!!errors.serial_number}
              helperText={errors.serial_number?.message}
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
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="maintenance">Maintenance</MenuItem>
              <MenuItem value="repair">Repair</MenuItem>
            </TextField>
            <TextField
              fullWidth
              label="Purchase Date"
              type="date"
              {...register('purchase_date')}
              margin="normal"
              size="small"
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            <TextField
              fullWidth
              label="Warranty Until"
              type="date"
              {...register('warranty_until')}
              margin="normal"
              size="small"
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={3}
              {...register('notes')}
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

export default Resources;