import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Chip,
  Alert,
  Divider,
  IconButton,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Avatar,
  Autocomplete,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
  Schedule as ScheduleIcon,
  AttachMoney as MoneyIcon,
  CalendarToday as CalendarIcon,
  PersonRemove as PersonRemoveIcon,
  DeleteForever as DeleteForeverIcon,
  Star as LeadIcon,
  StarBorder as MakeLeadIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { projectService, employeeService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_META: Record<string, { color: any; icon: React.ReactNode; bg: string; fg: string }> = {
  active:    { color: 'success',   icon: <PlayArrowIcon sx={{ fontSize: 14 }} />, bg: '#F0FDF4', fg: '#16A34A' },
  completed: { color: 'info',      icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, bg: '#EFF6FF', fg: '#2563EB' },
  'on-hold': { color: 'warning',   icon: <PauseIcon sx={{ fontSize: 14 }} />, bg: '#FFFBEB', fg: '#D97706' },
  planning:  { color: 'secondary', icon: <ScheduleIcon sx={{ fontSize: 14 }} />, bg: '#F8FAFC', fg: '#64748B' },
  cancelled: { color: 'error',     icon: <CancelIcon sx={{ fontSize: 14 }} />, bg: '#FEF2F2', fg: '#DC2626' },
};

// Must match backend LEAD_ROLE (app/api/v1/projects.py) - the exact role
// value that puts a member at the top of the hierarchy graph below.
const LEAD_ROLE = 'Lead';

const SectionPaper: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', mb: 2.5 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
    {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>}
    {!subtitle && <Box sx={{ mb: 2 }} />}
    {children}
  </Paper>
);

const ProjectDetail: React.FC = () => {
  const { id } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: project, isLoading, isError, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getById(projectId),
    enabled: !!projectId,
    retry: false,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => projectService.getMembers(projectId),
    enabled: !!projectId && !!project,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeService.getAll(),
    enabled: !!isAdmin,
  });

  const [form, setForm] = useState({
    name: '', description: '', status: 'active', start_date: '', end_date: '',
    budget: 0, progress: 0,
  });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name ?? '',
        description: project.description ?? '',
        status: project.status ?? 'active',
        start_date: project.start_date ? project.start_date.split('T')[0] : '',
        end_date: project.end_date ? project.end_date.split('T')[0] : '',
        budget: project.budget ?? 0,
        progress: project.progress ?? 0,
      });
    }
  }, [project]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => projectService.update(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update project')),
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => projectService.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to delete project'));
      setDeleteConfirmOpen(false);
    },
  });

  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [teamError, setTeamError] = useState('');

  const addMemberMutation = useMutation({
    mutationFn: (employeeId: number) => projectService.addMember(projectId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      setSelectedEmployee(null);
      setTeamError('');
      toast.success('Employee added to project');
    },
    onError: (e: any) => setTeamError(getErrorMessage(e, 'Failed to add employee to project')),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (employeeId: number) => projectService.removeMember(projectId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast.success('Employee removed from project');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to remove employee')),
  });

  const setLeadMutation = useMutation({
    mutationFn: ({ employeeId, makeLead }: { employeeId: number; makeLead: boolean }) =>
      projectService.updateMemberRole(projectId, employeeId, makeLead ? LEAD_ROLE : null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to update lead')),
  });

  const availableEmployees = (employees as any[]).filter(
    (emp: any) => !(members as any[]).some((m: any) => m.employee_id === emp.id)
  );

  const lead = (members as any[]).find((m: any) => m.role === LEAD_ROLE) ?? null;
  const otherMembers = (members as any[]).filter((m: any) => m !== lead);

  const renderMemberCard = (member: any, isLeadCard: boolean) => (
    <Paper
      key={member.id}
      variant="outlined"
      sx={{
        p: 1.5, borderRadius: 2, width: 170, textAlign: 'center', position: 'relative',
        borderColor: isLeadCard ? 'warning.main' : 'divider',
        bgcolor: isLeadCard ? '#FFFBEB' : 'background.paper',
      }}
    >
      {isAdmin && (
        <Box sx={{ position: 'absolute', top: 2, right: 2, display: 'flex' }}>
          <Tooltip title={isLeadCard ? 'Remove as lead' : 'Make lead'}>
            <IconButton
              size="small"
              disabled={setLeadMutation.isPending}
              onClick={() => setLeadMutation.mutate({ employeeId: member.employee_id, makeLead: !isLeadCard })}
            >
              {isLeadCard ? <LeadIcon sx={{ fontSize: 16, color: '#D97706' }} /> : <MakeLeadIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove from project">
            <IconButton
              size="small" color="error"
              disabled={removeMemberMutation.isPending}
              onClick={() => removeMemberMutation.mutate(member.employee_id)}
            >
              <PersonRemoveIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      <Avatar sx={{ width: 40, height: 40, mx: 'auto', mb: 1, bgcolor: isLeadCard ? '#D97706' : 'primary.main' }}>
        {member.employee?.first_name?.[0]}{member.employee?.last_name?.[0]}
      </Avatar>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {member.employee?.first_name} {member.employee?.last_name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {member.employee?.position}
      </Typography>
      {isLeadCard && <Chip label="Lead" size="small" color="warning" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />}
    </Paper>
  );

  if (isLoading) {
    return (
      <Box>
        <Skeleton width={120} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={220} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (isError || !project) {
    const status = (error as any)?.response?.status;
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/projects')} size="small" sx={{ mb: 2 }} color="inherit">
          Back to Projects
        </Button>
        <Alert severity={status === 403 ? 'warning' : 'error'}>
          {status === 403
            ? "You're not a member of this project, so you can't view its details."
            : 'Project not found.'}
        </Alert>
      </Box>
    );
  }

  const meta = STATUS_META[project.status] ?? STATUS_META.planning;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/projects')} size="small" sx={{ mb: 2 }} color="inherit">
          Back to Projects
        </Button>

        {/* Header */}
        <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>{project.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{project.description}</Typography>
            </Box>
            <Chip
              label={project.status}
              color={meta.color}
              sx={{ textTransform: 'capitalize', fontWeight: 600 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mt: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <MoneyIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">${project.budget?.toLocaleString() ?? 0}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CalendarIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">
                {new Date(project.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                {project.end_date && ` → ${new Date(project.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Progress</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: meta.fg }}>{project.progress ?? 0}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={project.progress ?? 0}
              sx={{ height: 6, borderRadius: 3, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: meta.fg } }}
            />
          </Box>
        </Paper>

        {/* Details (editable, admin only) */}
        {isAdmin && (
          <SectionPaper title="Project Details" subtitle="Editable by admins only.">
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                fullWidth size="small" label="Name" sx={{ gridColumn: '1 / -1' }}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <TextField
                fullWidth size="small" multiline rows={3} label="Description" sx={{ gridColumn: '1 / -1' }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <TextField
                fullWidth select size="small" label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <MenuItem value="planning">Planning</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="on-hold">On Hold</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
              <TextField
                fullWidth size="small" label="Budget" type="number"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
              />
              <TextField
                fullWidth size="small" label="Start Date" type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                fullWidth size="small" label="End Date" type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Progress</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>{form.progress}%</Typography>
                </Box>
                <Slider
                  value={form.progress}
                  onChange={(_, v) => setForm({ ...form, progress: v as number })}
                  min={0} max={100} step={5}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate(form)}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </Box>
          </SectionPaper>
        )}

        {/* Team */}
        <SectionPaper title="Team Hierarchy" subtitle={isAdmin ? 'Add or remove employees, and click the star to set the lead.' : undefined}>
          {isAdmin && (
            <>
              {teamError && <Alert severity="error" sx={{ mb: 2 }}>{teamError}</Alert>}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={availableEmployees}
                  value={selectedEmployee}
                  onChange={(_, value) => setSelectedEmployee(value)}
                  getOptionLabel={(emp: any) => `${emp.first_name} ${emp.last_name} (${emp.position})`}
                  isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
                  renderInput={(params) => <TextField {...params} placeholder="Search by name…" />}
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
            </>
          )}

          {membersLoading ? (
            <Skeleton height={160} variant="rectangular" sx={{ borderRadius: 1 }} />
          ) : (members as any[]).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No employees assigned to this project yet.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1, pb: 1 }}>
              {lead ? (
                <>
                  {renderMemberCard(lead, true)}
                  {otherMembers.length > 0 && (
                    <>
                      <Box sx={{ width: '2px', height: 20, bgcolor: 'divider' }} />
                      <Box sx={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', pt: 2, borderTop: '2px solid', borderColor: 'divider' }}>
                        {otherMembers.map((m: any) => (
                          <Box
                            key={m.id}
                            sx={{
                              position: 'relative', pt: 2,
                              '&::before': {
                                content: '""', position: 'absolute', top: 0, left: '50%',
                                transform: 'translateX(-50%)', width: '2px', height: '16px', bgcolor: 'divider',
                              },
                            }}
                          >
                            {renderMemberCard(m, false)}
                          </Box>
                        ))}
                      </Box>
                    </>
                  )}
                </>
              ) : (
                <>
                  {isAdmin && (
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                      No lead assigned yet - click the star on a member below to make them the lead.
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                    {otherMembers.map((m: any) => renderMemberCard(m, false))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </SectionPaper>

        {/* Danger zone */}
        {isAdmin && (
          <SectionPaper title="Danger Zone">
            <Button
              variant="outlined" color="error" size="small" startIcon={<DeleteForeverIcon />}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete Project
            </Button>
          </SectionPaper>
        )}

        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Delete Project</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>This cannot be undone.</Alert>
            <Typography variant="body2" color="text.secondary">
              Delete <strong>{project.name}</strong>? Assignments, invoices, and timesheet entries linked to it are
              kept but detached rather than deleted.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        <Divider sx={{ my: 2 }} />
      </Box>
    </motion.div>
  );
};

export default ProjectDetail;
