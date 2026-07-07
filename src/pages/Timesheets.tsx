import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Skeleton, Alert, MenuItem, IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Login as SendIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { timesheetService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/common/EmptyState';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.05 } }),
};

const getErrorMessage = (error: any): string => {
  if (!error) return 'An error occurred';
  const detail = error.response?.data?.detail;
  if (detail) {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((e: any) => e.msg || e).join(', ');
    return JSON.stringify(detail);
  }
  return error.message || 'An unexpected error occurred';
};

const getDefaultWeekStart = (): string => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
};

const STATUS_COLOR: Record<string, any> = {
  approved: 'success', submitted: 'warning', draft: 'default', rejected: 'error',
};

const Timesheets: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
  const [modalError, setModalError] = useState('');

  const [timesheetData, setTimesheetData] = useState({ week_start_date: getDefaultWeekStart() });
  const [entryData, setEntryData] = useState({
    project_id: '', date: new Date().toISOString().split('T')[0],
    hours: '', description: '', is_billable: true,
  });

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['timesheets'],
    queryFn: timesheetService.getMyTimesheets,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: () => timesheetService.create({ week_start_date: timesheetData.week_start_date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet created');
      setIsModalOpen(false);
      setTimesheetData({ week_start_date: getDefaultWeekStart() });
      setModalError('');
    },
    onError: (e: any) => setModalError(getErrorMessage(e)),
  });

  const addEntryMutation = useMutation({
    mutationFn: () => timesheetService.addEntry(selectedTimesheet.id, {
      project_id: entryData.project_id || null,
      date: entryData.date,
      hours: parseFloat(entryData.hours),
      description: entryData.description,
      is_billable: entryData.is_billable,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Entry added');
      setIsEntryModalOpen(false);
      setSelectedTimesheet(null);
      setEntryData({ project_id: '', date: new Date().toISOString().split('T')[0], hours: '', description: '', is_billable: true });
      setModalError('');
    },
    onError: (e: any) => setModalError(getErrorMessage(e)),
  });

  const deleteEntryMutation = useMutation({
    mutationFn: ({ timesheetId, entryId }: { timesheetId: number; entryId: number }) =>
      timesheetService.deleteEntry(timesheetId, entryId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Entry deleted'); },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => timesheetService.submit(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Timesheet submitted for approval'); },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => timesheetService.approve(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Timesheet approved'); },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const openAddEntry = (ts: any) => {
    setSelectedTimesheet(ts);
    setEntryData({ project_id: '', date: new Date().toISOString().split('T')[0], hours: '', description: '', is_billable: true });
    setModalError('');
    setIsEntryModalOpen(true);
  };

  const handleEntryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.name === 'is_billable' ? e.target.value === 'true' : e.target.value;
    setEntryData(prev => ({ ...prev, [e.target.name]: value }));
  };

  return (
    <Box>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Timesheets</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Track your weekly work hours by project</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setModalError(''); setIsModalOpen(true); }} size="small">
            New Timesheet
          </Button>
        </Box>
      </motion.div>

      {/* Timesheet cards */}
      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[0, 1].map(i => <Skeleton key={i} height={180} sx={{ borderRadius: 2 }} variant="rectangular" />)}
        </Box>
      ) : (timesheets as any[]).length === 0 ? (
        <Paper sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <EmptyState
            icon={<ScheduleIcon sx={{ fontSize: 48, color: '#C7D2FE' }} />}
            title="No timesheets yet"
            description="Create your first timesheet to start logging hours against projects."
            action={{ label: 'New Timesheet', onClick: () => setIsModalOpen(true) }}
          />
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(timesheets as any[]).map((ts: any, i: number) => (
            <motion.div key={ts.id} custom={i + 1} variants={fadeUp} initial="hidden" animate="visible">
              <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  {/* Card header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {new Date(ts.week_start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' – '}
                        {new Date(ts.week_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ts.total_hours?.toFixed(2) ?? 0} total hours
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={ts.status.charAt(0).toUpperCase() + ts.status.slice(1)}
                        color={STATUS_COLOR[ts.status] ?? 'default'}
                        size="small"
                        sx={{ fontWeight: 600, textTransform: 'capitalize' }}
                      />
                      {ts.status === 'draft' && (
                        <>
                          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => openAddEntry(ts)}>
                            Add Entry
                          </Button>
                          <Button size="small" variant="contained" startIcon={<SendIcon />}
                            onClick={() => submitMutation.mutate(ts.id)}
                            disabled={!ts.entries?.length || submitMutation.isPending}>
                            Submit
                          </Button>
                        </>
                      )}
                      {ts.status === 'submitted' && isAdmin && (
                        <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />}
                          onClick={() => approveMutation.mutate(ts.id)} disabled={approveMutation.isPending}>
                          Approve
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {/* Entries table */}
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          {['Date', 'Project', 'Hours', 'Description', 'Billable', ...(ts.status === 'draft' ? [''] : [])].map((h, j) => (
                            <TableCell key={j} align={h === '' ? 'right' : 'left'} sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.25 }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ts.entries?.length > 0 ? ts.entries.map((entry: any) => (
                          <TableRow key={entry.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                            <TableCell>{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</TableCell>
                            <TableCell>{entry.project?.name || <Typography component="span" variant="caption" color="text.secondary">General</Typography>}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{entry.hours}h</TableCell>
                            <TableCell sx={{ color: 'text.secondary', maxWidth: 220 }}>{entry.description || '—'}</TableCell>
                            <TableCell>
                              <Chip label={entry.is_billable ? 'Billable' : 'Non-billable'} size="small"
                                color={entry.is_billable ? 'success' : 'default'} variant={entry.is_billable ? 'filled' : 'outlined'} />
                            </TableCell>
                            {ts.status === 'draft' && (
                              <TableCell align="right">
                                <IconButton size="small" color="error"
                                  onClick={() => deleteEntryMutation.mutate({ timesheetId: ts.id, entryId: entry.id })}
                                  disabled={deleteEntryMutation.isPending}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={ts.status === 'draft' ? 6 : 5} sx={{ border: 0 }}>
                              <EmptyState title="No entries yet" description="Add time entries to this timesheet." compact />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Box>
      )}

      {/* Create Timesheet Dialog */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>New Timesheet</DialogTitle>
        <DialogContent>
          {modalError && <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>{modalError}</Alert>}
          <TextField fullWidth label="Week Start Date" type="date" name="week_start_date"
            value={timesheetData.week_start_date}
            onChange={e => setTimesheetData({ week_start_date: e.target.value })}
            margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} />
          <Typography variant="caption" color="text.secondary">
            The timesheet will cover 7 days from this date.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsModalOpen(false)} size="small">Cancel</Button>
          <Button variant="contained" size="small"
            onClick={() => createMutation.mutate()}
            disabled={!timesheetData.week_start_date || createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={isEntryModalOpen} onClose={() => setIsEntryModalOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>Add Entry</DialogTitle>
        <DialogContent>
          {modalError && <Alert severity="error" sx={{ mb: 1, borderRadius: 1 }}>{modalError}</Alert>}
          <TextField fullWidth select label="Project" name="project_id"
            value={entryData.project_id} onChange={handleEntryChange} margin="normal" size="small">
            <MenuItem value="">General / Non-Project</MenuItem>
            {(projects as any[]).map((p: any) => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Date" type="date" name="date"
            value={entryData.date} onChange={handleEntryChange}
            margin="normal" size="small" slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth label="Hours" type="number" name="hours"
            value={entryData.hours} onChange={handleEntryChange}
            margin="normal" size="small" slotProps={{ input: { inputProps: { step: 0.5, min: 0.5 } } }} />
          <TextField fullWidth label="Description" name="description"
            value={entryData.description} onChange={handleEntryChange}
            margin="normal" size="small" multiline rows={2} />
          <TextField fullWidth select label="Billable" name="is_billable"
            value={entryData.is_billable ? 'true' : 'false'} onChange={handleEntryChange}
            margin="normal" size="small">
            <MenuItem value="true">Billable</MenuItem>
            <MenuItem value="false">Non-Billable</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsEntryModalOpen(false)} size="small">Cancel</Button>
          <Button variant="contained" size="small"
            onClick={() => addEntryMutation.mutate()}
            disabled={!entryData.date || !entryData.hours || addEntryMutation.isPending}>
            {addEntryMutation.isPending ? 'Adding…' : 'Add Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Timesheets;
