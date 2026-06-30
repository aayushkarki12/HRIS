import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  TextField,
  CircularProgress,
  MenuItem,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { accountingService } from '../services/api';

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: '#2196f3',
  liability: '#f44336',
  equity: '#9c27b0',
  income: '#4caf50',
  expense: '#ff9800',
};

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GeneralLedger: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountType, setAccountType] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set());

  const params: any = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (accountType) params.account_type = accountType;

  const { data: ledger, isLoading, refetch } = useQuery({
    queryKey: ['ledger', startDate, endDate, accountType],
    queryFn: () => accountingService.getLedger(params),
  });

  const { data: summary } = useQuery({
    queryKey: ['ledgerSummary', startDate, endDate],
    queryFn: () => accountingService.getLedgerSummary(
      startDate || endDate ? { start_date: startDate || undefined, end_date: endDate || undefined } : undefined
    ),
  });

  const toggleAccount = (accountId: number) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const expandAll = () => {
    if (ledger) {
      setExpandedAccounts(new Set(ledger.map((a: any) => a.account_id)));
    }
  };

  const collapseAll = () => setExpandedAccounts(new Set());

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setAccountType('');
  };

  const totalDebit = ledger?.reduce((s: number, a: any) => s + a.total_debit, 0) || 0;
  const totalCredit = ledger?.reduce((s: number, a: any) => s + a.total_credit, 0) || 0;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
            General Ledger
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Account balances and transaction history
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {['asset', 'liability', 'equity', 'income', 'expense'].map((type) => {
          const data = summary?.[type];
          return (
            <Paper
              key={type}
              sx={{
                p: 2,
                flex: { xs: '1 1 100%', sm: '1 1 calc(20% - 16px)' },
                minWidth: '140px',
                borderRadius: 2,
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                borderTop: `3px solid ${ACCOUNT_TYPE_COLORS[type]}`,
              }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                {type}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: ACCOUNT_TYPE_COLORS[type] }}>
                {data ? fmt(data.balance) : '$0.00'}
              </Typography>
              {data && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography variant="caption" color="textSecondary">Dr: {fmt(data.total_debit)}</Typography>
                  <Typography variant="caption" color="textSecondary">Cr: {fmt(data.total_credit)}</Typography>
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FilterIcon color="action" />
          <TextField
            label="Start Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="End Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            select
            label="Account Type"
            size="small"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="asset">Asset</MenuItem>
            <MenuItem value="liability">Liability</MenuItem>
            <MenuItem value="equity">Equity</MenuItem>
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </TextField>
          {(startDate || endDate || accountType) && (
            <Button size="small" onClick={clearFilters}>Clear</Button>
          )}
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            <Button size="small" onClick={expandAll}>Expand All</Button>
            <Button size="small" onClick={collapseAll}>Collapse All</Button>
          </Box>
        </Box>
      </Paper>

      {/* Ledger Table */}
      {(!ledger || ledger.length === 0) ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="textSecondary">
            No posted transactions found. Post journal entries to see the ledger.
          </Typography>
        </Paper>
      ) : (
        <>
          {ledger.map((account: any) => {
            const isExpanded = expandedAccounts.has(account.account_id);
            return (
              <Paper
                key={account.account_id}
                sx={{ mb: 2, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}
              >
                {/* Account Header */}
                <Box
                  onClick={() => toggleAccount(account.account_id)}
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: '#fafafa',
                    '&:hover': { backgroundColor: '#f0f0f0' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton size="small">
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                    <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      {account.account_code}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {account.account_name}
                    </Typography>
                    <Chip
                      label={account.account_type}
                      size="small"
                      sx={{
                        bgcolor: `${ACCOUNT_TYPE_COLORS[account.account_type]}15`,
                        color: ACCOUNT_TYPE_COLORS[account.account_type],
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="textSecondary">Debit</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(account.total_debit)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="textSecondary">Credit</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{fmt(account.total_credit)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', minWidth: 100 }}>
                      <Typography variant="caption" color="textSecondary">Balance</Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: account.closing_balance >= 0 ? '#2e7d32' : '#d32f2f',
                        }}
                      >
                        {fmt(account.closing_balance)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Transaction Lines */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableCell><strong>Date</strong></TableCell>
                          <TableCell><strong>Entry #</strong></TableCell>
                          <TableCell><strong>Description</strong></TableCell>
                          <TableCell><strong>Reference</strong></TableCell>
                          <TableCell align="right"><strong>Debit</strong></TableCell>
                          <TableCell align="right"><strong>Credit</strong></TableCell>
                          <TableCell align="right"><strong>Balance</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {account.lines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 2 }}>
                              <Typography variant="body2" color="textSecondary">No transactions</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          account.lines.map((line: any) => (
                            <TableRow key={line.id} hover>
                              <TableCell>{new Date(line.date).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                  {line.entry_number}
                                </Typography>
                              </TableCell>
                              <TableCell>{line.description || line.entry_description}</TableCell>
                              <TableCell>{line.reference || '-'}</TableCell>
                              <TableCell align="right" sx={{ color: line.debit > 0 ? '#2196f3' : 'text.secondary' }}>
                                {line.debit > 0 ? fmt(line.debit) : '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ color: line.credit > 0 ? '#4caf50' : 'text.secondary' }}>
                                {line.credit > 0 ? fmt(line.credit) : '-'}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontWeight: 600, color: line.running_balance >= 0 ? '#2e7d32' : '#d32f2f' }}
                              >
                                {fmt(line.running_balance)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                        <TableRow sx={{ backgroundColor: '#f9f9f9' }}>
                          <TableCell colSpan={4}><strong>Account Total</strong></TableCell>
                          <TableCell align="right"><strong>{fmt(account.total_debit)}</strong></TableCell>
                          <TableCell align="right"><strong>{fmt(account.total_credit)}</strong></TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, color: account.closing_balance >= 0 ? '#2e7d32' : '#d32f2f' }}
                          >
                            <strong>{fmt(account.closing_balance)}</strong>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Paper>
            );
          })}

          {/* Grand Totals */}
          <Paper sx={{ p: 2, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="textSecondary">Total Debits</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2196f3' }}>{fmt(totalDebit)}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="textSecondary">Total Credits</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#4caf50' }}>{fmt(totalCredit)}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="textSecondary">Difference</Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: Math.abs(totalDebit - totalCredit) < 0.01 ? '#2e7d32' : '#d32f2f' }}
                >
                  {fmt(Math.abs(totalDebit - totalCredit))}
                  {Math.abs(totalDebit - totalCredit) < 0.01 && ' (Balanced)'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default GeneralLedger;
