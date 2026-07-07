import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, MenuItem, LinearProgress, Slider,
  Skeleton, Tooltip, IconButton, List, ListItem, ListItemText,
  ListItemAvatar, Avatar, Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  Folder as FolderIcon,
  Group as GroupIcon,
  PersonRemove as PersonRemoveIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { projectService, employeeService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/common/EmptyState';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.04 } }),
};

const projectSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  status: z.enum(['active', 'completed', 'on-hold', 'planning', 'cancelled']),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  budget: z.number().min(0),
  progress: z.number().min(0).max(100),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const STATUS_META: Record<string, { color: any; icon: React.ReactNode; bg: string; fg: string }> = {
  active:    { color: 'success',   icon: <PlayArrowIcon sx={{ fontSize: 14 }} />, bg: '#F0FDF4', fg: '#16A34A' },
  completed: { color: 'info',      icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, bg: '#EFF6FF', fg: '#2563EB' },
  'on-hold': { color: 'warning',   icon: <PauseIcon sx={{ fontSize: 14 }} />, bg: '#FFFBEB', fg: '#D97706' },
  planning:  { color: 'secondary', icon: <ScheduleIcon sx={{ fontSize: 14 }} />, bg: '#F8FAFC', fg: '#64748B' },
  cancelled: { color: 'error',     icon: <CancelIcon sx={{ fontSize: 14 }} />, bg: '#FEF2F2', fg: '#DC2626' },
};

const Projects: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [teamProjectId, setTeamProjectId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [teamError, setTeamError] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeService.getAll(),
    enabled: !!isAdmin,
  });

  const { data: teamMembers = [], isLoading: teamLoading } = useQuery({
    queryKey: ['project-members', teamProjectId],
    queryFn: () => projectService.getMembers(teamProjectId as number),
    enabled: teamProjectId !== null,
  });

  const addMemberMutation = useMutation({
    mutationFn: (employeeId: number) => projectService.addMember(teamProjectId as number, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', teamProjectId] });
      setSelectedEmployee(null);
      setTeamError('');
      toast.success('Employee added to project');
    },
    onError: (e: any) => setTeamError(getErrorMessage(e, 'Failed to add employee to project')),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (employeeId: number) => projectService.removeMember(teamProjectId as number, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', teamProjectId] });
      toast.success('Employee removed from project');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to remove employee')),
  });

  const closeTeamModal = () => {
    setTeamProjectId(null);
    setSelectedEmployee(null);
    setTeamError('');
  };

  const availableEmployees = (employees as any[]).filter(
    (emp: any) => !(teamMembers as any[]).some((m: any) => m.employee_id === emp.id)
  );

  const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: { progress: 0, status: 'active' },
  });

  const createMutation = useMutation({
    mutationFn: projectService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
      closeModal();
    },
    onError: (e: any) => setFormError(getErrorMessage(e, 'Failed to create project')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => projectService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
      closeModal();
    },
    onError: (e: any) => setFormError(getErrorMessage(e, 'Failed to update project')),
  });

  const deleteMutation = useMutation({
    mutationFn: projectService.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project deleted'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to delete project')),
  });

  const closeModal = () => { setIsModalOpen(false); reset({ progress: 0, status: 'active' }); setEditingId(null); setFormError(''); };

  const handleEdit = (p: any) => {
    setEditingId(p.id);
    setValue('name', p.name);
    setValue('description', p.description);
    setValue('status', p.status);
    setValue('start_date', p.start_date?.split('T')[0] ?? '');
    setValue('end_date', p.end_date ? p.end_date.split('T')[0] : '');
    setValue('budget', p.budget ?? 0);
    setValue('progress', p.progress ?? 0);
    setFormError('');
    setIsModalOpen(true);
  };

  const onSubmit = (data: ProjectFormData) => {
    setFormError('');
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const statusCounts = {
    active: (projects as any[]).filter((p: any) => p.status === 'active').length,
    completed: (projects as any[]).filter((p: any) => p.status === 'completed').length,
    'on-hold': (projects as any[]).filter((p: any) => p.status === 'on-hold').length,
    cancelled: (projects as any[]).filter((p: any) => p.status === 'cancelled').length,
  };

  return (
    <Box>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Projects</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Track project progress and manage your team's work</Typography>
          </Box>
          {isAdmin && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setIsModalOpen(true)}>
              New Project
            </Button>
          )}
        </Box>
      </motion.div>

      {/* Stat chips */}
      <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
          {Object.entries(statusCounts).map(([s, count]) => {
            const meta = STATUS_META[s];
            return (
              <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.75, borderRadius: '8px', bgcolor: meta.bg, border: '1px solid', borderColor: `${meta.fg}30` }}>
                <Box sx={{ color: meta.fg, display: 'flex' }}>{meta.icon}</Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: meta.fg }}>{count}</Typography>
                <Typography variant="caption" sx={{ color: meta.fg, textTransform: 'capitalize', opacity: 0.8 }}>{s}</Typography>
              </Box>
            );
          })}
        </Box>
      </motion.div>

      {/* Grid */}
      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={220} sx={{ borderRadius: 2 }} variant="rectangular" />)}
        </Box>
      ) : (projects as any[]).length === 0 ? (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <EmptyState
            icon={<FolderIcon sx={{ fontSize: 48, color: '#C7D2FE' }} />}
            title="No projects yet"
            description="Create your first project to start tracking work and progress."
            action={isAdmin ? { label: 'New Project', onClick: () => setIsModalOpen(true) } : undefined}
          />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
          {(projects as any[]).map((project: any, i: number) => {
            const meta = STATUS_META[project.status] ?? STATUS_META.planning;
            const progress = project.progress ?? 0;
            return (
              <motion.div key={project.id} custom={i + 2} variants={fadeUp} initial="hidden" animate="visible">
                <Card sx={{
                  borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none',
                  height: '100%', display: 'flex', flexDirection: 'column',
                  transition: 'box-shadow 0.15s, transform 0.15s',
                  '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
                }}>
                  <CardContent sx={{ flex: 1, p: 2.5 }}>
                    {/* Status + name */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 1, lineHeight: 1.3 }}>
                        {project.name}
                      </Typography>
                      <Chip
                        label={project.status}
                        color={meta.color}
                        size="small"
                        sx={{ textTransform: 'capitalize', fontWeight: 600, flexShrink: 0 }}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{
                      mb: 2, display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5,
                    }}>
                      {project.description}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                      <MoneyIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        ${project.budget?.toLocaleString() ?? 0}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
                      <CalendarIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(project.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {project.end_date && ` → ${new Date(project.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </Typography>
                    </Box>

                    {/* Progress */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Progress</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: meta.fg }}>{progress}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          height: 5, borderRadius: 3,
                          bgcolor: '#F1F5F9',
                          '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: meta.fg },
                        }}
                      />
                    </Box>
                  </CardContent>

                  {isAdmin && (
                    <CardActions sx={{ px: 2.5, pb: 2, pt: 0, gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined" startIcon={<GroupIcon />} onClick={() => setTeamProjectId(project.id)}>
                        Team
                      </Button>
                      <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleEdit(project)}>
                        Edit
                      </Button>
                      <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />}
                        onClick={() => deleteMutation.mutate(project.id)} disabled={deleteMutation.isPending}>
                        Delete
                      </Button>
                    </CardActions>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isModalOpen} onClose={closeModal} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>{editingId ? 'Edit Project' : 'New Project'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ pt: 1 }}>
            {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{formError}</Alert>}

            <TextField fullWidth label="Name *" {...register('name')} error={!!errors.name} helperText={errors.name?.message} margin="normal" size="small" />
            <TextField fullWidth multiline rows={3} label="Description *" {...register('description')} error={!!errors.description} helperText={errors.description?.message} margin="normal" size="small" />
            <TextField fullWidth select label="Status" {...register('status')} error={!!errors.status} helperText={errors.status?.message} margin="normal" size="small">
              <MenuItem value="planning">Planning</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            <TextField fullWidth label="Start Date *" type="date" {...register('start_date')} error={!!errors.start_date} helperText={errors.start_date?.message} margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth label="End Date" type="date" {...register('end_date')} margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth label="Budget *" type="number" {...register('budget', { valueAsNumber: true })} error={!!errors.budget} helperText={errors.budget?.message} margin="normal" size="small" />

            {/* Progress slider */}
            <Box sx={{ mt: 2, mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Progress</Typography>
                <Controller name="progress" control={control} render={({ field }) => (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>{field.value}%</Typography>
                )} />
              </Box>
              <Controller
                name="progress"
                control={control}
                render={({ field }) => (
                  <Slider
                    {...field}
                    min={0} max={100} step={5}
                    valueLabelDisplay="auto"
                    valueLabelFormat={v => `${v}%`}
                    marks={[{ value: 0, label: '0%' }, { value: 50, label: '50%' }, { value: 100, label: '100%' }]}
                    sx={{ color: 'primary.main' }}
                  />
                )}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeModal} size="small">Cancel</Button>
            <Button type="submit" variant="contained" size="small" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {(isSubmitting || createMutation.isPending || updateMutation.isPending) ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Manage Team Dialog */}
      <Dialog open={teamProjectId !== null} onClose={closeTeamModal} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          Manage Team — {(projects as any[]).find((p: any) => p.id === teamProjectId)?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {teamError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{teamError}</Alert>}

          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
            Add employee to project
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <Autocomplete
              key={teamProjectId ?? 'none'}
              fullWidth
              size="small"
              options={availableEmployees}
              value={selectedEmployee}
              onChange={(_, value) => setSelectedEmployee(value)}
              getOptionLabel={(emp: any) => `${emp.first_name} ${emp.last_name} (${emp.position})`}
              isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
              renderInput={(params) => (
                <TextField {...params} placeholder="Search by name…" />
              )}
            />
            <Button
              variant="contained"
              size="small"
              disabled={!selectedEmployee || addMemberMutation.isPending}
              onClick={() => selectedEmployee && addMemberMutation.mutate(selectedEmployee.id)}
            >
              Add
            </Button>
          </Box>

          {teamLoading ? (
            <Skeleton height={120} variant="rectangular" sx={{ borderRadius: 1 }} />
          ) : (teamMembers as any[]).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No employees assigned to this project yet.
            </Typography>
          ) : (
            <List dense>
              {(teamMembers as any[]).map((member: any) => (
                <ListItem
                  key={member.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      color="error"
                      disabled={removeMemberMutation.isPending}
                      onClick={() => removeMemberMutation.mutate(member.employee_id)}
                    >
                      <PersonRemoveIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                      {member.employee?.first_name?.[0]}{member.employee?.last_name?.[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${member.employee?.first_name ?? ''} ${member.employee?.last_name ?? ''}`}
                    secondary={member.employee?.position}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeTeamModal} size="small">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Projects;
