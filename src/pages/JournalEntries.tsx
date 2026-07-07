import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Divider,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  CheckCircle as PostIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  RemoveCircleOutlined as RemoveLineIcon,
  AddCircleOutlined as AddLineIcon,
} from '@mui/icons-material';
import { accountingService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

interface LineForm {
  account_id: string;
  description: string;
  debit: string;
  credit: string;
}

const emptyLine: LineForm = { account_id: '', description: '', debit: '', credit: '' };

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const JournalEntries: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    reference_type: 'manual',
  });
  const [lines, setLines] = useState<LineForm[]>([
    { ...emptyLine },
    { ...emptyLine },
  ]);

  const { data: entries, isLoading, refetch } = useQuery({
    queryKey: ['journalEntries'],
    queryFn: () => accountingService.getJournalEntries(),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingService.getAccounts(),
  });

  const activeAccounts = accounts?.filter((a: any) => a.is_active) || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => accountingService.createJournalEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      toast.success('Journal entry created successfully');
      handleCloseModal();
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error, 'Failed to create journal entry');
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const postMutation = useMutation({
    mutationFn: (id: number) => accountingService.postJournalEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      toast.success('Journal entry posted successfully');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error, 'Failed to post journal entry');
      toast.error(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountingService.deleteJournalEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      toast.success('Journal entry deleted');
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage(error, 'Failed to delete journal entry');
      toast.error(errorMsg);
    },
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      reference_type: 'manual',
    });
    setLines([{ ...emptyLine }, { ...emptyLine }]);
    setError('');
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLineChange = (index: number, field: keyof LineForm, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'debit' && value) {
      updated[index].credit = '';
    } else if (field === 'credit' && value) {
      updated[index].debit = '';
    }

    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { ...emptyLine }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const getTotalDebit = () => lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const getTotalCredit = () => lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = () => {
    const d = getTotalDebit();
    const c = getTotalCredit();
    return d > 0 && Math.abs(d - c) < 0.01;
  };

  const handleSubmit = () => {
    setError('');

    const entryLines = lines
      .filter((l) => l.account_id && (l.debit || l.credit))
      .map((l) => ({
        account_id: Number(l.account_id),
        description: l.description || null,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));

    if (entryLines.length < 2) {
      setError('At least 2 lines are required');
      return;
    }

    createMutation.mutate({
      date: formData.date,
      description: formData.description,
      reference: formData.reference || null,
      reference_type: formData.reference_type,
      lines: entryLines,
    });
  };

  const handlePost = (entry: any) => {
    if (window.confirm(`Post journal entry ${entry.entry_number}? This cannot be undone.`)) {
      postMutation.mutate(entry.id);
    }
  };

  const handleDelete = (entry: any) => {
    if (window.confirm(`Delete draft journal entry ${entry.entry_number}?`)) {
      deleteMutation.mutate(entry.id);
    }
  };

  const filteredEntries = entries?.filter((e: any) =>
    selectedStatus === 'all' || e.status === selectedStatus
  );

  const getAccountName = (accountId: number) => {
    const account = accounts?.find((a: any) => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : `Account #${accountId}`;
  };

  if (!isManager) {
    return <AccessDenied />;
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
            Journal Entries
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Record and manage double-entry transactions
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
            Refresh
          </Button>
          {isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsModalOpen(true)}>
              New Entry
            </Button>
          )}
        </Box>
      </Box>

      {/* Summary */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Entries', value: entries?.length || 0, color: '#667eea' },
          { label: 'Draft', value: entries?.filter((e: any) => e.status === 'draft').length || 0, color: '#f39c12' },
          { label: 'Posted', value: entries?.filter((e: any) => e.status === 'posted').length || 0, color: '#2ecc71' },
        ].map((stat) => (
          <Paper key={stat.label} sx={{ p: 2, flex: { xs: '1 1 100%', sm: '1 1 calc(33% - 16px)' }, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
              {stat.label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Filter Chips */}
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        {['all', 'draft', 'posted'].map((s) => (
          <Chip
            key={s}
            label={s.charAt(0).toUpperCase() + s.slice(1)}
            onClick={() => setSelectedStatus(s)}
            color={selectedStatus === s ? 'primary' : 'default'}
            variant={selectedStatus === s ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {/* Entries Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell width={40}></TableCell>
              <TableCell><strong>Entry #</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell><strong>Reference</strong></TableCell>
              <TableCell align="right"><strong>Total</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEntries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 8 : 7} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">No journal entries found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries?.map((entry: any) => {
                const totalDebit = entry.lines?.reduce((s: number, l: any) => s + l.debit, 0) || 0;
                const isExpanded = expandedRow === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton size="small" onClick={() => setExpandedRow(isExpanded ? null : entry.id)}>
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {entry.entry_number}
                        </Typography>
                      </TableCell>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.reference || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {fmt(totalDebit)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={entry.status}
                          color={entry.status === 'posted' ? 'success' : 'warning'}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell align="right">
                          {entry.status === 'draft' && (
                            <>
                              <IconButton size="small" color="success" onClick={() => handlePost(entry)} title="Post">
                                <PostIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => handleDelete(entry)} title="Delete">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 4 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                              Entry Lines
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell><strong>Account</strong></TableCell>
                                  <TableCell><strong>Description</strong></TableCell>
                                  <TableCell align="right"><strong>Debit</strong></TableCell>
                                  <TableCell align="right"><strong>Credit</strong></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {entry.lines?.map((line: any) => (
                                  <TableRow key={line.id}>
                                    <TableCell>
                                      {line.account ? `${line.account.code} - ${line.account.name}` : getAccountName(line.account_id)}
                                    </TableCell>
                                    <TableCell>{line.description || '-'}</TableCell>
                                    <TableCell align="right" sx={{ color: line.debit > 0 ? '#2196f3' : 'text.secondary' }}>
                                      {line.debit > 0 ? fmt(line.debit) : '-'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: line.credit > 0 ? '#4caf50' : 'text.secondary' }}>
                                      {line.credit > 0 ? fmt(line.credit) : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                                  <TableCell colSpan={2}><strong>Totals</strong></TableCell>
                                  <TableCell align="right">
                                    <strong>
                                      {fmt(entry.lines?.reduce((s: number, l: any) => s + l.debit, 0) || 0)}
                                    </strong>
                                  </TableCell>
                                  <TableCell align="right">
                                    <strong>
                                      {fmt(entry.lines?.reduce((s: number, l: any) => s + l.credit, 0) || 0)}
                                    </strong>
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Dialog */}
      <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>Create Journal Entry</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleFormChange}
              margin="normal"
              size="small"
              sx={{ flex: '1 1 200px' }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Reference"
              name="reference"
              value={formData.reference}
              onChange={handleFormChange}
              margin="normal"
              size="small"
              sx={{ flex: '1 1 200px' }}
              placeholder="Optional reference number"
            />
            <TextField
              select
              label="Type"
              name="reference_type"
              value={formData.reference_type}
              onChange={handleFormChange}
              margin="normal"
              size="small"
              sx={{ flex: '1 1 150px' }}
            >
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="payroll">Payroll</MenuItem>
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="invoice">Invoice</MenuItem>
            </TextField>
          </Box>
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleFormChange}
            margin="normal"
            size="small"
            placeholder="Describe this journal entry"
          />

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Entry Lines</Typography>
            <Button size="small" startIcon={<AddLineIcon />} onClick={addLine}>
              Add Line
            </Button>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '35%' }}><strong>Account</strong></TableCell>
                <TableCell sx={{ width: '25%' }}><strong>Description</strong></TableCell>
                <TableCell sx={{ width: '15%' }} align="right"><strong>Debit</strong></TableCell>
                <TableCell sx={{ width: '15%' }} align="right"><strong>Credit</strong></TableCell>
                <TableCell sx={{ width: '10%' }} align="center"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={line.account_id}
                      onChange={(e) => handleLineChange(index, 'account_id', e.target.value)}
                      variant="outlined"
                    >
                      <MenuItem value="">Select Account</MenuItem>
                      {activeAccounts.map((acc: any) => (
                        <MenuItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value={line.description}
                      onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                      placeholder="Optional"
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={line.debit}
                      onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                      slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                      disabled={!!line.credit}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 0.5 }}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      value={line.credit}
                      onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                      slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                      disabled={!!line.debit}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ py: 0.5 }}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                    >
                      <RemoveLineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                <TableCell colSpan={2} align="right"><strong>Totals</strong></TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#2196f3' }}>
                    {fmt(getTotalDebit())}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#4caf50' }}>
                    {fmt(getTotalCredit())}
                  </Typography>
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {getTotalDebit() > 0 && !isBalanced() && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Debits ({getTotalDebit().toFixed(2)}) do not equal Credits ({getTotalCredit().toFixed(2)}).
              Difference: {Math.abs(getTotalDebit() - getTotalCredit()).toFixed(2)}
            </Alert>
          )}
          {isBalanced() && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Entry is balanced
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.description || !formData.date || !isBalanced() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JournalEntries;
