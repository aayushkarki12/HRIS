import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  MenuItem,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { timesheetService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Helper function to get error message
const getErrorMessage = (error: any): string => {
  if (!error) return 'An error occurred';
  if (typeof error === 'string') return error;
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((err: any) => err.msg || err).join(', ');
    }
    if (typeof detail === 'object') {
      return JSON.stringify(detail);
    }
    return String(detail);
  }
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return 'An unexpected error occurred';
};

// Get Monday of current week
const getDefaultWeekStart = (): string => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
};

const Timesheets: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  // Form state for timesheet creation
  const [timesheetData, setTimesheetData] = useState({
    week_start_date: getDefaultWeekStart(),
  });

  // Form state for entry
  const [entryData, setEntryData] = useState({
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
    is_billable: true,
  });

  // Fetch timesheets
  const { data: timesheets, isLoading, refetch } = useQuery({
    queryKey: ['timesheets'],
    queryFn: timesheetService.getMyTimesheets,
  });

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  // Create timesheet mutation
  const createTimesheetMutation = useMutation({
    mutationFn: () => {
      if (!timesheetData.week_start_date) {
        throw new Error('Week start date is required');
      }
      return timesheetService.create({ week_start_date: timesheetData.week_start_date });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet created successfully');
      setIsModalOpen(false);
      setTimesheetData({ week_start_date: getDefaultWeekStart() });
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  // Add entry mutation
  const addEntryMutation = useMutation({
    mutationFn: () => {
      return timesheetService.addEntry(selectedTimesheet.id, {
        project_id: entryData.project_id || null,
        date: entryData.date,
        hours: parseFloat(entryData.hours),
        description: entryData.description,
        is_billable: entryData.is_billable,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Entry added successfully');
      setIsEntryModalOpen(false);
      setSelectedTimesheet(null);
      setEditingEntry(null);
      setEntryData({
        project_id: '',
        date: new Date().toISOString().split('T')[0],
        hours: '',
        description: '',
        is_billable: true,
      });
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  // Delete entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: ({ timesheetId, entryId }: { timesheetId: number; entryId: number }) =>
      timesheetService.deleteEntry(timesheetId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Entry deleted successfully');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
    },
  });

  // Submit timesheet mutation
  const submitTimesheetMutation = useMutation({
    mutationFn: (id: number) => timesheetService.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet submitted for approval');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
    },
  });

  // Approve timesheet mutation
  const approveTimesheetMutation = useMutation({
    mutationFn: (id: number) => timesheetService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Timesheet approved');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
    },
  });

  // Handlers
  const handleTimesheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimesheetData({ ...timesheetData, [e.target.name]: e.target.value });
  };

  const handleEntryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.name === 'is_billable' ? e.target.value === 'true' : e.target.value;
    setEntryData({ ...entryData, [e.target.name]: value });
  };

  const handleCreateTimesheet = () => {
    setError('');
    createTimesheetMutation.mutate();
  };

  const handleAddEntry = () => {
    setError('');
    addEntryMutation.mutate();
  };

  const openAddEntry = (timesheet: any) => {
    setSelectedTimesheet(timesheet);
    setEditingEntry(null);
    setEntryData({
      project_id: '',
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: '',
      is_billable: true,
    });
    setIsEntryModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, any> = {
      approved: 'success',
      submitted: 'warning',
      draft: 'default',
      rejected: 'error',
    };
    return colors[status] || 'default';
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
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
            Timesheets
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Track your weekly work hours
          </Typography>
        </Box>
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
            Create Timesheet
          </Button>
        </Box>
      </Box>

      {/* Timesheets List */}
      <Grid container spacing={3}>
        {timesheets && timesheets.length > 0 ? (
          timesheets.map((timesheet: any) => (
            <Grid key={timesheet.id} xs={12}>
              <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="h6">
                        Week: {new Date(timesheet.week_start_date).toLocaleDateString()} - {new Date(timesheet.week_end_date).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Total Hours: {timesheet.total_hours?.toFixed(2) || 0}h
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={timesheet.status}
                        color={getStatusColor(timesheet.status)}
                        size="small"
                      />
                      {timesheet.status === 'draft' && (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => openAddEntry(timesheet)}
                          >
                            Add Entry
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<SendIcon />}
                            onClick={() => submitTimesheetMutation.mutate(timesheet.id)}
                            disabled={!timesheet.entries || timesheet.entries.length === 0}
                          >
                            Submit
                          </Button>
                        </>
                      )}
                      {timesheet.status === 'submitted' && isAdmin && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckIcon />}
                          onClick={() => approveTimesheetMutation.mutate(timesheet.id)}
                        >
                          Approve
                        </Button>
                      )}
                    </Box>
                  </Box>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableCell><strong>Date</strong></TableCell>
                          <TableCell><strong>Project</strong></TableCell>
                          <TableCell><strong>Hours</strong></TableCell>
                          <TableCell><strong>Description</strong></TableCell>
                          <TableCell><strong>Billable</strong></TableCell>
                          {timesheet.status === 'draft' && <TableCell align="right"><strong>Actions</strong></TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {timesheet.entries?.map((entry: any) => (
                          <TableRow key={entry.id}>
                            <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                            <TableCell>{entry.project?.name || 'General'}</TableCell>
                            <TableCell>{entry.hours}h</TableCell>
                            <TableCell>{entry.description || '-'}</TableCell>
                            <TableCell>
                              <Chip
                                label={entry.is_billable ? 'Billable' : 'Non-Billable'}
                                size="small"
                                color={entry.is_billable ? 'success' : 'default'}
                              />
                            </TableCell>
                            {timesheet.status === 'draft' && (
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    if (window.confirm('Delete this entry?')) {
                                      deleteEntryMutation.mutate({
                                        timesheetId: timesheet.id,
                                        entryId: entry.id,
                                      });
                                    }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {(!timesheet.entries || timesheet.entries.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
                                No entries yet
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid xs={12}>
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <Box sx={{ fontSize: 64, mb: 2 }}>📋</Box>
              <Typography variant="h6" sx={{ mb: 1 }}>No timesheets found</Typography>
              <Typography variant="body2" color="textSecondary">
                Create your first timesheet to start tracking hours
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Create Timesheet Dialog */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Timesheet</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Week Start Date"
            type="date"
            name="week_start_date"
            value={timesheetData.week_start_date}
            onChange={handleTimesheetChange}
            margin="normal"
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Typography variant="caption" color="textSecondary">
            The week will automatically be 7 days from the start date
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTimesheet}
            disabled={!timesheetData.week_start_date || createTimesheetMutation.isPending}
          >
            {createTimesheetMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={isEntryModalOpen} onClose={() => setIsEntryModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            select
            label="Project"
            name="project_id"
            value={entryData.project_id}
            onChange={handleEntryChange}
            margin="normal"
            size="small"
          >
            <MenuItem value="">General / Non-Project</MenuItem>
            {projects?.map((project: any) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Date"
            type="date"
            name="date"
            value={entryData.date}
            onChange={handleEntryChange}
            margin="normal"
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            fullWidth
            label="Hours"
            type="number"
            name="hours"
            value={entryData.hours}
            onChange={handleEntryChange}
            margin="normal"
            size="small"
            inputProps={{ step: 0.5, min: 0.5 }}
          />
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={entryData.description}
            onChange={handleEntryChange}
            margin="normal"
            size="small"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            select
            label="Billable"
            name="is_billable"
            value={entryData.is_billable ? 'true' : 'false'}
            onChange={handleEntryChange}
            margin="normal"
            size="small"
          >
            <MenuItem value="true">Billable</MenuItem>
            <MenuItem value="false">Non-Billable</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEntryModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddEntry}
            disabled={!entryData.date || !entryData.hours || addEntryMutation.isPending}
          >
            {addEntryMutation.isPending ? 'Adding...' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Timesheets;