import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Checkbox, TextField, MenuItem, CircularProgress, Alert,
  Chip, Card, CardContent,
} from '@mui/material';
import { CheckCircle as ReconcileIcon } from '@mui/icons-material';
import { accountingService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BankReconciliation: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [accountId, setAccountId] = useState<string>('');
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingService.getAccounts({ account_type: 'asset' }),
  });

  const { data: status, isLoading } = useQuery({
    queryKey: ['reconciliation-status', accountId],
    queryFn: () => accountingService.getReconciliationStatus(Number(accountId)),
    enabled: !!accountId,
  });

  const { data: history } = useQuery({
    queryKey: ['reconciliation-history', accountId],
    queryFn: () => accountingService.getReconciliationHistory(Number(accountId)),
    enabled: !!accountId,
  });

  const reconcileMutation = useMutation({
    mutationFn: () => accountingService.reconcileAccount(Number(accountId), {
      line_ids: selectedLines,
      statement_date: statementDate,
      statement_balance: Number(statementBalance),
      notes: notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-status', accountId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-history', accountId] });
      toast.success('Reconciliation recorded');
      setSelectedLines([]);
      setStatementBalance('');
      setNotes('');
      setError('');
    },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to reconcile')),
  });

  const toggleLine = (id: number) => {
    setSelectedLines((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const selectedTotal = (status?.unreconciled_lines ?? [])
    .filter((l: any) => selectedLines.includes(l.id))
    .reduce((sum: number, l: any) => sum + (l.debit - l.credit), 0);

  if (!isManager) {
    return <AccessDenied />;
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>Bank Reconciliation</Typography>
        <Typography variant="body2" color="textSecondary">Match your ledger's cash/bank transactions against a bank statement</Typography>
      </Box>

      <TextField
        select
        label="Cash / Bank Account"
        value={accountId}
        onChange={(e) => { setAccountId(e.target.value); setSelectedLines([]); }}
        size="small"
        sx={{ minWidth: 320, mb: 3 }}
      >
        <MenuItem value="">Select an account</MenuItem>
        {(accounts ?? []).map((a: any) => (
          <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>
        ))}
      </TextField>

      {!accountId ? (
        <Alert severity="info">Pick an account above to see its unreconciled transactions.</Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="caption" color="textSecondary">Book Balance</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmt(status?.book_balance ?? 0)}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="caption" color="textSecondary">Already Reconciled</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2ecc71' }}>{fmt(status?.reconciled_balance ?? 0)}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="caption" color="textSecondary">Selected for this session</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#667eea' }}>{fmt(selectedTotal)}</Typography>
              </CardContent>
            </Card>
          </Box>

          {isAdmin && (
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  label="Statement Date" type="date" value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)} size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Statement Balance" type="number" value={statementBalance}
                  onChange={(e) => setStatementBalance(e.target.value)} size="small"
                />
                <TextField
                  label="Notes (optional)" value={notes}
                  onChange={(e) => setNotes(e.target.value)} size="small" sx={{ flex: 1, minWidth: 200 }}
                />
                <Button
                  variant="contained"
                  startIcon={<ReconcileIcon />}
                  disabled={selectedLines.length === 0 || !statementBalance || reconcileMutation.isPending}
                  onClick={() => reconcileMutation.mutate()}
                >
                  Reconcile {selectedLines.length > 0 ? `(${selectedLines.length})` : ''}
                </Button>
              </Box>
            </Paper>
          )}

          <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  {isAdmin && <TableCell padding="checkbox"></TableCell>}
                  <TableCell><strong>Voucher #</strong></TableCell>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell align="right"><strong>Debit</strong></TableCell>
                  <TableCell align="right"><strong>Credit</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(status?.unreconciled_lines ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">Everything is reconciled for this account 🎉</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  status.unreconciled_lines.map((line: any) => (
                    <TableRow key={line.id} hover selected={selectedLines.includes(line.id)}>
                      {isAdmin && (
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedLines.includes(line.id)} onChange={() => toggleLine(line.id)} />
                        </TableCell>
                      )}
                      <TableCell sx={{ fontFamily: 'monospace' }}>{line.entry_number}</TableCell>
                      <TableCell>{new Date(line.date).toLocaleDateString()}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell align="right" sx={{ color: line.debit > 0 ? '#2196f3' : 'text.secondary' }}>
                        {line.debit > 0 ? fmt(line.debit) : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: line.credit > 0 ? '#f44336' : 'text.secondary' }}>
                        {line.credit > 0 ? fmt(line.credit) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Reconciliation History</Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Statement Date</strong></TableCell>
                  <TableCell align="right"><strong>Statement Balance</strong></TableCell>
                  <TableCell align="right"><strong>Book Balance</strong></TableCell>
                  <TableCell align="right"><strong>Difference</strong></TableCell>
                  <TableCell><strong>Notes</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(history ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No past reconciliations</Typography></TableCell></TableRow>
                ) : (
                  history.map((h: any) => (
                    <TableRow key={h.id} hover>
                      <TableCell>{new Date(h.statement_date).toLocaleDateString()}</TableCell>
                      <TableCell align="right">{fmt(h.statement_balance)}</TableCell>
                      <TableCell align="right">{fmt(h.book_balance)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={fmt(h.difference)}
                          color={Math.abs(h.difference) < 0.01 ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{h.notes || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default BankReconciliation;
