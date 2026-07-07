import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, MenuItem, Skeleton, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Computer as ComputerIcon,
  Laptop as LaptopIcon,
  Keyboard as KeyboardIcon,
  Mouse as MouseIcon,
  Devices as OtherIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Build as BuildIcon,
  Cancel as CancelIcon,
  SendOutlined as RequestIcon,
  CheckOutlined as ApproveIcon,
  CloseOutlined as RejectIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { resourceService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/common/EmptyState';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.04 } }),
};

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

const STATUS_COLOR: Record<string, any> = {
  available: 'success', assigned: 'primary', maintenance: 'warning', repair: 'error',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  laptop: <LaptopIcon sx={{ fontSize: 32 }} />,
  monitor: <ComputerIcon sx={{ fontSize: 32 }} />,
  keyboard: <KeyboardIcon sx={{ fontSize: 32 }} />,
  mouse: <MouseIcon sx={{ fontSize: 32 }} />,
  other: <OtherIcon sx={{ fontSize: 32 }} />,
};

const TYPE_COLOR: Record<string, string> = {
  laptop: '#4F46E5', monitor: '#0891B2', keyboard: '#D97706', mouse: '#16A34A', other: '#64748B',
};

const REQUEST_STATUS_COLOR: Record<string, any> = {
  pending: 'warning', approved: 'success', rejected: 'error',
};

const Resources: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [requestDialog, setRequestDialog] = useState<{ open: boolean; resource: any | null }>({ open: false, resource: null });
  const [requestReason, setRequestReason] = useState('');
  const [decideDialog, setDecideDialog] = useState<{ open: boolean; request: any | null; action: 'approve' | 'reject' }>({ open: false, request: null, action: 'approve' });
  const [adminNotes, setAdminNotes] = useState('');

  const { data: resources = [], isLoading: resLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: resourceService.getAll,
  });

  const { data: requests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['resource-requests'],
    queryFn: resourceService.getRequests,
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
  });

  const createMutation = useMutation({
    mutationFn: resourceService.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['resources'] }); toast.success('Resource created'); closeModal(); },
    onError: (e: any) => setFormError(getErrorMessage(e, 'Failed to create resource')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => resourceService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['resources'] }); toast.success('Resource updated'); closeModal(); },
    onError: (e: any) => setFormError(getErrorMessage(e, 'Failed to update resource')),
  });

  const deleteMutation = useMutation({
    mutationFn: resourceService.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['resources'] }); toast.success('Resource deleted'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Cannot delete this resource')),
  });

  const requestMutation = useMutation({
    mutationFn: ({ resource_id, reason }: { resource_id: number; reason: string }) =>
      resourceService.createRequest({ resource_id, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-requests'] });
      toast.success('Request submitted — admin will review it');
      setRequestDialog({ open: false, resource: null });
      setRequestReason('');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to submit request')),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => resourceService.approveRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-requests'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Request approved — resource assigned');
      setDecideDialog({ open: false, request: null, action: 'approve' });
      setAdminNotes('');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to approve request')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => resourceService.rejectRequest(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-requests'] });
      toast.success('Request rejected');
      setDecideDialog({ open: false, request: null, action: 'approve' });
      setAdminNotes('');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to reject request')),
  });

  const closeModal = () => { setIsModalOpen(false); reset(); setEditingId(null); setFormError(''); };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setValue('asset_tag', r.asset_tag || '');
    setValue('name', r.name);
    setValue('type', r.type);
    setValue('model', r.model || '');
    setValue('serial_number', r.serial_number);
    setValue('status', r.status);
    setValue('purchase_date', r.purchase_date || '');
    setValue('warranty_until', r.warranty_until || '');
    setValue('notes', r.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const onSubmit = (data: ResourceFormData) => {
    setFormError('');
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const pendingCount = (requests as any[]).filter((r: any) => r.status === 'pending').length;

  return (
    <Box>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Resources</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Manage IT assets and equipment requests</Typography>
          </Box>
          {isAdmin && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setIsModalOpen(true)}>
              Add Resource
            </Button>
          )}
        </Box>
      </motion.div>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, minWidth: 'auto', mr: 2, px: 0 } }}>
          <Tab label="All Resources" />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                {isAdmin ? 'Requests' : 'My Requests'}
                {pendingCount > 0 && (
                  <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'error.main', color: '#fff', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pendingCount}
                  </Box>
                )}
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* ── Tab 0: Resources ── */}
      {tab === 0 && (
        resLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={180} sx={{ borderRadius: 2 }} variant="rectangular" />)}
          </Box>
        ) : (resources as any[]).length === 0 ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <EmptyState
              icon={<ComputerIcon sx={{ fontSize: 48, color: '#C7D2FE' }} />}
              title="No resources yet"
              description="Add your first IT asset to start tracking equipment."
              action={isAdmin ? { label: 'Add Resource', onClick: () => setIsModalOpen(true) } : undefined}
            />
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
            {(resources as any[]).map((resource: any, i: number) => {
              const typeColor = TYPE_COLOR[resource.type] ?? '#64748B';
              return (
                <motion.div key={resource.id} custom={i + 1} variants={fadeUp} initial="hidden" animate="visible">
                  <Card sx={{
                    borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none',
                    height: '100%', display: 'flex', flexDirection: 'column',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                    '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
                  }}>
                    <CardContent sx={{ flex: 1, p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Box sx={{ p: 1.25, borderRadius: '10px', bgcolor: `${typeColor}15`, color: typeColor, display: 'flex' }}>
                          {TYPE_ICON[resource.type]}
                        </Box>
                        <Chip label={resource.status} color={STATUS_COLOR[resource.status] ?? 'default'} size="small" sx={{ textTransform: 'capitalize', fontWeight: 600 }} />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25 }}>{resource.name}</Typography>
                      {resource.model && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{resource.model}</Typography>}
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>SN: {resource.serial_number}</Typography>
                      {resource.asset_tag && <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>Tag: {resource.asset_tag}</Typography>}
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1, flexWrap: 'wrap' }}>
                      {!isAdmin && resource.status === 'available' && (
                        <Button size="small" variant="contained" startIcon={<RequestIcon />}
                          onClick={() => { setRequestDialog({ open: true, resource }); setRequestReason(''); }}
                          sx={{ fontSize: '0.75rem' }}>
                          Request
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleEdit(resource)}>Edit</Button>
                          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />}
                            onClick={() => deleteMutation.mutate(resource.id)} disabled={deleteMutation.isPending}>
                            Delete
                          </Button>
                        </>
                      )}
                    </CardActions>
                  </Card>
                </motion.div>
              );
            })}
          </Box>
        )
      )}

      {/* ── Tab 1: Requests ── */}
      {tab === 1 && (
        reqLoading ? (
          <Skeleton height={200} sx={{ borderRadius: 2 }} variant="rectangular" />
        ) : (requests as any[]).length === 0 ? (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <EmptyState
              title="No requests yet"
              description={isAdmin ? 'Employee resource requests will appear here.' : 'You haven\'t requested any resources yet.'}
              compact
            />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                  {['Resource', ...(isAdmin ? ['Requested by'] : []), 'Reason', 'Status', 'Date', ...(isAdmin ? ['Actions'] : [])].map((h, i) => (
                    <TableCell key={i} align={h === 'Actions' ? 'right' : 'left'} sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5 }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(requests as any[]).map((req: any) => (
                  <TableRow key={req.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{req.resource?.name ?? `Resource #${req.resource_id}`}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{req.resource?.type}</Typography>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Typography variant="body2">{req.employee?.first_name} {req.employee?.last_name}</Typography>
                      </TableCell>
                    )}
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 200 }}>{req.reason || '—'}</TableCell>
                    <TableCell>
                      <Chip label={req.status} color={REQUEST_STATUS_COLOR[req.status] ?? 'default'} size="small" sx={{ fontWeight: 600, textTransform: 'capitalize' }} />
                      {req.admin_notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{req.admin_notes}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        {req.status === 'pending' && (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <IconButton size="small" color="success"
                              onClick={() => { setDecideDialog({ open: true, request: req, action: 'approve' }); setAdminNotes(''); }}>
                              <ApproveIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error"
                              onClick={() => { setDecideDialog({ open: true, request: req, action: 'reject' }); setAdminNotes(''); }}>
                              <RejectIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}

      {/* Add/Edit Resource Dialog */}
      <Dialog open={isModalOpen} onClose={closeModal} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>{editingId ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent sx={{ pt: 1 }}>
            {formError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{formError}</Alert>}
            <TextField fullWidth label="Asset Tag" {...register('asset_tag')} margin="normal" size="small" />
            <TextField fullWidth label="Name *" {...register('name')} error={!!errors.name} helperText={errors.name?.message} margin="normal" size="small" />
            <TextField fullWidth select label="Type *" {...register('type')} error={!!errors.type} helperText={errors.type?.message} margin="normal" size="small">
              <MenuItem value="laptop">Laptop</MenuItem>
              <MenuItem value="monitor">Monitor</MenuItem>
              <MenuItem value="keyboard">Keyboard</MenuItem>
              <MenuItem value="mouse">Mouse</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField fullWidth label="Model" {...register('model')} margin="normal" size="small" />
            <TextField fullWidth label="Serial Number *" {...register('serial_number')} error={!!errors.serial_number} helperText={errors.serial_number?.message} margin="normal" size="small" />
            <TextField fullWidth select label="Status" {...register('status')} error={!!errors.status} helperText={errors.status?.message} margin="normal" size="small">
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="maintenance">Maintenance</MenuItem>
              <MenuItem value="repair">Repair</MenuItem>
            </TextField>
            <TextField fullWidth label="Purchase Date" type="date" {...register('purchase_date')} margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth label="Warranty Until" type="date" {...register('warranty_until')} margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth label="Notes" multiline rows={2} {...register('notes')} margin="normal" size="small" />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeModal} size="small">Cancel</Button>
            <Button type="submit" variant="contained" size="small" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Request Resource Dialog */}
      <Dialog open={requestDialog.open} onClose={() => setRequestDialog({ open: false, resource: null })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>Request Resource</DialogTitle>
        <DialogContent>
          {requestDialog.resource && (
            <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: '#F8FAFC', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{requestDialog.resource.name}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{requestDialog.resource.type} · {requestDialog.resource.model}</Typography>
            </Box>
          )}
          <TextField fullWidth label="Reason (optional)" multiline rows={3} value={requestReason}
            onChange={e => setRequestReason(e.target.value)}
            placeholder="Why do you need this resource?" size="small" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setRequestDialog({ open: false, resource: null })}>Cancel</Button>
          <Button size="small" variant="contained"
            disabled={requestMutation.isPending}
            onClick={() => requestDialog.resource && requestMutation.mutate({ resource_id: requestDialog.resource.id, reason: requestReason })}>
            {requestMutation.isPending ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve / Reject Dialog */}
      <Dialog open={decideDialog.open} onClose={() => setDecideDialog({ open: false, request: null, action: 'approve' })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1, color: decideDialog.action === 'approve' ? 'success.main' : 'error.main' }}>
          {decideDialog.action === 'approve' ? 'Approve Request' : 'Reject Request'}
        </DialogTitle>
        <DialogContent>
          {decideDialog.request && (
            <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: '#F8FAFC', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{decideDialog.request.resource?.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                Requested by {decideDialog.request.employee?.first_name} {decideDialog.request.employee?.last_name}
              </Typography>
              {decideDialog.request.reason && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>"{decideDialog.request.reason}"</Typography>
              )}
            </Box>
          )}
          <TextField fullWidth label="Notes (optional)" multiline rows={2} value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)} size="small"
            placeholder={decideDialog.action === 'approve' ? 'Any instructions for the employee…' : 'Reason for rejection…'} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setDecideDialog({ open: false, request: null, action: 'approve' })}>Cancel</Button>
          <Button size="small" variant="contained"
            color={decideDialog.action === 'approve' ? 'success' : 'error'}
            disabled={approveMutation.isPending || rejectMutation.isPending}
            onClick={() => {
              if (!decideDialog.request) return;
              if (decideDialog.action === 'approve') approveMutation.mutate({ id: decideDialog.request.id, notes: adminNotes });
              else rejectMutation.mutate({ id: decideDialog.request.id, notes: adminNotes });
            }}>
            {decideDialog.action === 'approve' ? 'Approve & Assign' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Resources;
