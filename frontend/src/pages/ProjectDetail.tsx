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
  Star as MakeLeadIcon,
  LocationOn as LocationIcon,
  GpsFixed as LiveTrackingIcon,
  GpsOff as NoTrackingIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { projectService, employeeService, workLocationService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ProjectNodeTree, ProjectRootCard, NodeFormDialog, LeadersDialog, flattenNodes, countMembersRecursive,
  ProjectNodeData, ProjectNodeTreeActions,
} from '../components/hierarchy/ProjectNodeTree';

const STATUS_META: Record<string, { color: any; icon: React.ReactNode; bg: string; fg: string }> = {
  active:    { color: 'success',   icon: <PlayArrowIcon sx={{ fontSize: 14 }} />, bg: '#F0FDF4', fg: '#16A34A' },
  completed: { color: 'info',      icon: <CheckCircleIcon sx={{ fontSize: 14 }} />, bg: '#EFF6FF', fg: '#2563EB' },
  'on-hold': { color: 'warning',   icon: <PauseIcon sx={{ fontSize: 14 }} />, bg: '#FFFBEB', fg: '#D97706' },
  planning:  { color: 'secondary', icon: <ScheduleIcon sx={{ fontSize: 14 }} />, bg: '#F8FAFC', fg: '#64748B' },
  cancelled: { color: 'error',     icon: <CancelIcon sx={{ fontSize: 14 }} />, bg: '#FEF2F2', fg: '#DC2626' },
};

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
  const { isAdmin, hasPermission, user } = useAuth();
  const canEditStructure = isAdmin || hasPermission('projects.manage');
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
    // Needed for the add-member control both on the project root and
    // within any unit a caller (admin, PM, or a unit leader) can manage.
    enabled: !!projectId && !!project,
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

  // ---- Team & organizational structure ----
  // One unified tree, rooted at the project itself (ProjectRootCard), with
  // units/sub-units nested below it (ProjectNodeTree). A member added to
  // any unit is a member of this project by construction - ProjectMember
  // always carries project_id, node_id just refines where within it - so
  // there's no separate "make them a project member too" step anywhere.
  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ['project-nodes', projectId],
    queryFn: () => projectService.getNodes(projectId),
    enabled: !!projectId && !!project,
  });

  const { data: projectLeaders = [] } = useQuery({
    queryKey: ['project-leaders', projectId],
    queryFn: () => projectService.getProjectLeaders(projectId),
    enabled: !!projectId && !!project,
  });

  const invalidateStructure = () => {
    queryClient.invalidateQueries({ queryKey: ['project-nodes', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project-leaders', projectId] });
  };

  const addMemberMutation = useMutation({
    mutationFn: ({ nodeId, employeeId }: { nodeId: number | null; employeeId: number }) =>
      projectService.addMember(projectId, employeeId, undefined, nodeId),
    onSuccess: () => { invalidateStructure(); toast.success('Employee added'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to add employee')),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ nodeId, employeeId }: { nodeId: number | null; employeeId: number }) =>
      projectService.removeMember(projectId, employeeId, nodeId),
    onSuccess: () => { invalidateStructure(); toast.success('Employee removed'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to remove employee')),
  });

  const [nodeFormDialog, setNodeFormDialog] = useState<{ open: boolean; mode: 'create' | 'edit'; node?: ProjectNodeData; parentNodeId?: number | null }>({ open: false, mode: 'create' });
  const [nodeFormError, setNodeFormError] = useState('');

  const createNodeMutation = useMutation({
    mutationFn: (data: { name: string; parent_node_id: number | null; work_location_id: number | null }) =>
      projectService.createNode(projectId, data),
    onSuccess: () => { invalidateStructure(); setNodeFormDialog({ open: false, mode: 'create' }); setNodeFormError(''); toast.success('Unit created'); },
    onError: (e: any) => setNodeFormError(getErrorMessage(e, 'Failed to create unit')),
  });

  const updateNodeMutation = useMutation({
    mutationFn: (data: { name: string; parent_node_id: number | null; work_location_id: number | null }) => {
      const node = nodeFormDialog.node!;
      const changingParent = data.parent_node_id !== node.parent_node_id;
      const changingLocation = data.work_location_id !== (node.work_location_id ?? null);
      return projectService.updateNode(projectId, node.id, {
        name: data.name,
        parent_node_id: data.parent_node_id ?? undefined,
        clear_parent: changingParent && data.parent_node_id === null,
        work_location_id: data.work_location_id ?? undefined,
        clear_work_location: changingLocation && data.work_location_id === null,
      });
    },
    onSuccess: () => { invalidateStructure(); setNodeFormDialog({ open: false, mode: 'create' }); setNodeFormError(''); toast.success('Unit updated'); },
    onError: (e: any) => setNodeFormError(getErrorMessage(e, 'Failed to update unit')),
  });

  const [deleteNodeDialog, setDeleteNodeDialog] = useState<{ open: boolean; node?: ProjectNodeData; error?: string; canCascade?: boolean }>({ open: false });

  const deleteNodeMutation = useMutation({
    mutationFn: ({ node, cascade }: { node: ProjectNodeData; cascade: boolean }) => projectService.deleteNode(projectId, node.id, cascade),
    onSuccess: () => { invalidateStructure(); setDeleteNodeDialog({ open: false }); toast.success('Unit deleted'); },
    onError: (e: any) => setDeleteNodeDialog((prev) => ({ ...prev, error: getErrorMessage(e, 'Failed to delete unit'), canCascade: true })),
  });

  // Which unit (or the project root) the Leaders dialog is currently open
  // for - null nodeId + isRoot means "the project itself".
  const [leadersTarget, setLeadersTarget] = useState<{ isRoot: boolean; nodeId: number | null } | null>(null);
  const [leaderError, setLeaderError] = useState('');

  const leadersDialogNode = !leadersTarget || leadersTarget.isRoot
    ? null
    : flattenNodes(nodes as ProjectNodeData[]).find((f) => f.node.id === leadersTarget.nodeId)?.node ?? null;
  const leadersDialogTitle = leadersTarget?.isRoot ? (project?.name ?? '') : (leadersDialogNode?.name ?? '');
  const leadersDialogLeaders = leadersTarget?.isRoot ? (projectLeaders as any[]) : (leadersDialogNode?.leaders ?? []);

  const addLeaderMutation = useMutation({
    mutationFn: ({ userId, title }: { userId: number; title: string }) =>
      leadersTarget?.isRoot
        ? projectService.addProjectLeader(projectId, userId, title)
        : projectService.addNodeLeader(projectId, leadersTarget!.nodeId as number, userId, title),
    onSuccess: () => { invalidateStructure(); setLeaderError(''); toast.success('Leader added'); },
    onError: (e: any) => setLeaderError(getErrorMessage(e, 'Failed to add leader')),
  });

  const removeLeaderMutation = useMutation({
    mutationFn: (leaderId: number) =>
      leadersTarget?.isRoot
        ? projectService.removeProjectLeader(projectId, leaderId)
        : projectService.removeNodeLeader(projectId, leadersTarget!.nodeId as number, leaderId),
    onSuccess: () => { invalidateStructure(); toast.success('Leader removed'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to remove leader')),
  });

  // Every unit this user directly or transitively leads, computed from the
  // already-fetched (and already backend-pruned-to-scope) tree - a unit
  // leader can manage members anywhere in their own subtree, mirroring
  // app/core/hierarchy_scope.py::leader_node_ids without a separate call.
  const myLedNodeIds = React.useMemo(() => {
    const ids = new Set<number>();
    const walk = (list: ProjectNodeData[], inherited: boolean) => {
      for (const n of list) {
        const leads = inherited || n.leaders.some((l) => l.user_id === user?.id);
        if (leads) ids.add(n.id);
        walk(n.children, leads);
      }
    };
    walk(nodes as ProjectNodeData[], false);
    return ids;
  }, [nodes, user?.id]);

  // A leader of the project as a whole (see app/core/hierarchy_scope.py::
  // leader_project_ids) can manage membership anywhere - root included -
  // same as canEditStructure, just granted via leadership instead of a
  // tenant-wide permission.
  const amProjectLeader = (projectLeaders as any[]).some((l: any) => l.user_id === user?.id);
  const canManageRootMembers = canEditStructure || amProjectLeader;
  const canManageMembersForNode = (node: ProjectNodeData) => canEditStructure || amProjectLeader || myLedNodeIds.has(node.id);

  const leaderCandidates = (employees as any[])
    .filter((e: any) => e.user_id)
    .map((e: any) => ({ user_id: e.user_id as number, label: `${e.first_name} ${e.last_name}` }));

  const { data: projectLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['project-work-locations', projectId],
    queryFn: () => projectService.getWorkLocations(projectId),
    enabled: !!projectId && !!project,
  });

  const { data: allWorkLocations = [] } = useQuery({
    queryKey: ['work-locations'],
    queryFn: () => workLocationService.getAll(),
    enabled: !!projectId && !!project,
  });

  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [locationError, setLocationError] = useState('');

  const addLocationMutation = useMutation({
    mutationFn: (workLocationId: number) => projectService.addWorkLocation(projectId, workLocationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-work-locations', projectId] });
      setSelectedLocation(null);
      setLocationError('');
      toast.success('Work location assigned to project');
    },
    onError: (e: any) => setLocationError(getErrorMessage(e, 'Failed to assign work location')),
  });

  const removeLocationMutation = useMutation({
    mutationFn: (workLocationId: number) => projectService.removeWorkLocation(projectId, workLocationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-work-locations', projectId] });
      toast.success('Work location removed (kept in history)');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to remove work location')),
  });

  const toggleTrackingMutation = useMutation({
    mutationFn: ({ workLocationId, liveTracking }: { workLocationId: number; liveTracking: boolean }) =>
      projectService.updateWorkLocationTracking(projectId, workLocationId, liveTracking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-work-locations', projectId] });
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to update live tracking')),
  });

  const setPrimaryLocationMutation = useMutation({
    mutationFn: (workLocationId: number) => projectService.setPrimaryWorkLocation(projectId, workLocationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-work-locations', projectId] });
      toast.success('Primary location updated');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to set primary location')),
  });

  const activeLocations = (projectLocations as any[]).filter((l: any) => l.is_active);
  const pastLocations = (projectLocations as any[]).filter((l: any) => !l.is_active);
  const availableWorkLocations = (allWorkLocations as any[]).filter(
    (wl: any) => !activeLocations.some((l: any) => l.work_location_id === wl.id)
  );

  // The project's own resolved location: whichever site is primary, or
  // just the first active one if none is marked primary yet. This is what
  // any unit without its own location falls back to displaying.
  const projectPrimaryLocation = activeLocations.find((l: any) => l.is_primary) ?? activeLocations[0];
  const projectLocationLabel = projectPrimaryLocation?.work_location?.name ?? 'No location set';

  const rootMembers = (members as any[]).filter((m: any) => m.node_id == null);
  const totalMemberCount = rootMembers.length + countMembersRecursive(nodes as ProjectNodeData[]);

  const nodeTreeActions: ProjectNodeTreeActions = {
    canEditStructure,
    canManageMembers: canManageMembersForNode,
    onOpenCreate: (parentNodeId) => { setNodeFormError(''); setNodeFormDialog({ open: true, mode: 'create', parentNodeId }); },
    onOpenEdit: (node) => { setNodeFormError(''); setNodeFormDialog({ open: true, mode: 'edit', node }); },
    onOpenDelete: (node) => setDeleteNodeDialog({ open: true, node }),
    onOpenLeaders: (node) => { setLeaderError(''); setLeadersTarget({ isRoot: false, nodeId: node.id }); },
    availableEmployees: employees as any[],
    onAddMember: (node, employeeId) => addMemberMutation.mutate({ nodeId: node.id, employeeId }),
    onRemoveMember: (node, employeeId) => removeMemberMutation.mutate({ nodeId: node.id, employeeId }),
    addMemberPending: addMemberMutation.isPending,
    removeMemberPending: removeMemberMutation.isPending,
    projectLocationLabel,
  };

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
              <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>{project.name}</Typography>
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

        {/* Team & organizational structure - the project itself sits at the
            top (ProjectRootCard) as the explicit parent of every top-level
            unit; units nest below to any depth. Everyone assigned anywhere
            in the tree is part of this project, since ProjectMember always
            carries project_id regardless of which unit refines it. */}
        <SectionPaper
          title="Team & Structure"
          subtitle={canEditStructure ? 'Optionally break this project into units and appoint leaders - a leader only sees and manages their own branch.' : undefined}
        >
          {nodesLoading || membersLoading ? (
            <Skeleton height={140} variant="rectangular" sx={{ borderRadius: 1 }} />
          ) : (
            <>
              <ProjectRootCard
                projectName={project.name}
                locationLabel={projectLocationLabel}
                leaders={projectLeaders as any[]}
                directMembers={rootMembers}
                totalMemberCount={totalMemberCount}
                canEditStructure={canEditStructure}
                canManageMembers={canManageRootMembers}
                availableEmployees={employees as any[]}
                onAddUnit={() => { setNodeFormError(''); setNodeFormDialog({ open: true, mode: 'create', parentNodeId: null }); }}
                onOpenLeaders={() => { setLeaderError(''); setLeadersTarget({ isRoot: true, nodeId: null }); }}
                onAddMember={(employeeId) => addMemberMutation.mutate({ nodeId: null, employeeId })}
                onRemoveMember={(employeeId) => removeMemberMutation.mutate({ nodeId: null, employeeId })}
                addMemberPending={addMemberMutation.isPending}
                removeMemberPending={removeMemberMutation.isPending}
              />
              <ProjectNodeTree nodes={nodes as ProjectNodeData[]} actions={nodeTreeActions} />
            </>
          )}
        </SectionPaper>

        {/* Work Locations */}
        <SectionPaper
          title="Work Locations"
          subtitle={isAdmin ? "Sites valid for this project's attendance geofence check. Toggle live tracking per site." : undefined}
        >
          {isAdmin && (
            <>
              {locationError && <Alert severity="error" sx={{ mb: 2 }}>{locationError}</Alert>}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={availableWorkLocations}
                  value={selectedLocation}
                  onChange={(_, value) => setSelectedLocation(value)}
                  getOptionLabel={(wl: any) => `${wl.is_office ? `${wl.name} (Office)` : wl.name}${wl.address ? ` — ${wl.address}` : ''}`}
                  isOptionEqualToValue={(opt: any, val: any) => opt.id === val.id}
                  renderInput={(params) => <TextField {...params} placeholder="Search work locations…" />}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={!selectedLocation || addLocationMutation.isPending}
                  onClick={() => selectedLocation && addLocationMutation.mutate(selectedLocation.id)}
                >
                  Add
                </Button>
              </Box>
            </>
          )}

          {locationsLoading ? (
            <Skeleton height={80} variant="rectangular" sx={{ borderRadius: 1 }} />
          ) : activeLocations.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No work locations assigned - attendance for this project's members falls back to just the tenant's primary office location.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activeLocations.map((link: any) => (
                <Paper key={link.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <LocationIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{link.work_location?.name}</Typography>
                      {link.is_primary && <Chip label="Primary" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />}
                      {link.work_location?.is_office && <Chip label="Office" size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                    </Box>
                    {link.work_location?.address && (
                      <Typography variant="caption" color="text.secondary">{link.work_location.address}</Typography>
                    )}
                  </Box>
                  {isAdmin && !link.is_primary && (
                    <Tooltip title="Set as primary location">
                      <IconButton
                        size="small"
                        disabled={setPrimaryLocationMutation.isPending}
                        onClick={() => setPrimaryLocationMutation.mutate(link.work_location_id)}
                      >
                        <MakeLeadIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Chip
                    size="small"
                    icon={link.live_tracking ? <LiveTrackingIcon sx={{ fontSize: 14 }} /> : <NoTrackingIcon sx={{ fontSize: 14 }} />}
                    label={link.live_tracking ? 'Live tracking on' : 'Live tracking off'}
                    color={link.live_tracking ? 'success' : 'default'}
                    variant="outlined"
                    onClick={isAdmin ? () => toggleTrackingMutation.mutate({ workLocationId: link.work_location_id, liveTracking: !link.live_tracking }) : undefined}
                    sx={{ cursor: isAdmin ? 'pointer' : 'default' }}
                  />
                  {isAdmin && (
                    <Tooltip title="Remove from project">
                      <IconButton
                        size="small" color="error"
                        disabled={removeLocationMutation.isPending}
                        onClick={() => removeLocationMutation.mutate(link.work_location_id)}
                      >
                        <PersonRemoveIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Paper>
              ))}
            </Box>
          )}

          {pastLocations.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <HistoryIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Past locations</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {pastLocations.map((link: any) => (
                  <Box key={link.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.6 }}>
                    <Typography variant="caption" sx={{ flex: 1 }}>{link.work_location?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      removed {link.removed_at ? new Date(link.removed_at).toLocaleDateString() : ''}
                    </Typography>
                  </Box>
                ))}
              </Box>
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

        <NodeFormDialog
          open={nodeFormDialog.open}
          onClose={() => setNodeFormDialog({ open: false, mode: 'create' })}
          mode={nodeFormDialog.mode}
          projectName={project.name}
          allNodes={nodes as ProjectNodeData[]}
          workLocations={allWorkLocations as any[]}
          projectLocationLabel={projectLocationLabel}
          initial={
            nodeFormDialog.mode === 'edit' && nodeFormDialog.node
              ? { name: nodeFormDialog.node.name, parent_node_id: nodeFormDialog.node.parent_node_id, work_location_id: nodeFormDialog.node.work_location_id ?? null }
              : { name: '', parent_node_id: nodeFormDialog.parentNodeId ?? null, work_location_id: null }
          }
          excludeSubtreeOf={nodeFormDialog.mode === 'edit' ? nodeFormDialog.node : undefined}
          onSubmit={(data) => (nodeFormDialog.mode === 'create' ? createNodeMutation.mutate(data) : updateNodeMutation.mutate(data))}
          submitting={createNodeMutation.isPending || updateNodeMutation.isPending}
          error={nodeFormError}
        />

        <Dialog open={deleteNodeDialog.open} onClose={() => setDeleteNodeDialog({ open: false })} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Delete Unit</DialogTitle>
          <DialogContent>
            {deleteNodeDialog.error ? (
              <Alert severity="error" sx={{ mb: 2 }}>{deleteNodeDialog.error}</Alert>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>This cannot be undone.</Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Delete <strong>{deleteNodeDialog.node?.name}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteNodeDialog({ open: false })} color="inherit">Cancel</Button>
            {deleteNodeDialog.canCascade && (
              <Button
                variant="outlined" color="error"
                disabled={deleteNodeMutation.isPending}
                onClick={() => deleteNodeDialog.node && deleteNodeMutation.mutate({ node: deleteNodeDialog.node, cascade: true })}
              >
                Delete anyway (removes sub-units &amp; members)
              </Button>
            )}
            <Button
              variant="contained" color="error"
              disabled={deleteNodeMutation.isPending}
              onClick={() => deleteNodeDialog.node && deleteNodeMutation.mutate({ node: deleteNodeDialog.node, cascade: false })}
            >
              {deleteNodeMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        <LeadersDialog
          open={!!leadersTarget}
          onClose={() => setLeadersTarget(null)}
          title={leadersDialogTitle}
          leaders={leadersDialogLeaders}
          availableLeaderCandidates={leaderCandidates}
          onAdd={(userId, title) => addLeaderMutation.mutate({ userId, title })}
          onRemove={(leaderId) => removeLeaderMutation.mutate(leaderId)}
          addPending={addLeaderMutation.isPending}
          removePending={removeLeaderMutation.isPending}
          error={leaderError}
        />

        <Divider sx={{ my: 2 }} />
      </Box>
    </motion.div>
  );
};

export default ProjectDetail;
