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
  CircularProgress,
  TextField,
  Tabs,
  Tab,
  Chip,
  Alert,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { accountingService } from '../services/api';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_COLORS: Record<string, string> = {
  asset: '#2196f3', liability: '#f44336', equity: '#9c27b0', income: '#4caf50', expense: '#ff9800',
};

const FinancialReports: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedCash, setExpandedCash] = useState<number | null>(null);

  const dateParams: any = {};
  if (startDate) dateParams.start_date = startDate;
  if (endDate) dateParams.end_date = endDate;

  const { data: trialBalance, isLoading: tbLoading, refetch: refetchTB } = useQuery({
    queryKey: ['trialBalance', startDate, endDate],
    queryFn: () => accountingService.getTrialBalance(dateParams),
    enabled: tab === 0,
  });

  const { data: incomeStatement, isLoading: isLoading, refetch: refetchIS } = useQuery({
    queryKey: ['incomeStatement', startDate, endDate],
    queryFn: () => accountingService.getIncomeStatement(dateParams),
    enabled: tab === 1,
  });

  const { data: balanceSheet, isLoading: bsLoading, refetch: refetchBS } = useQuery({
    queryKey: ['balanceSheet', endDate],
    queryFn: () => accountingService.getBalanceSheet(endDate ? { end_date: endDate } : undefined),
    enabled: tab === 2,
  });

  const { data: cashFlow, isLoading: cfLoading, refetch: refetchCF } = useQuery({
    queryKey: ['cashFlow', startDate, endDate],
    queryFn: () => accountingService.getCashFlow(dateParams),
    enabled: tab === 3,
  });

  const refetchAll = () => { refetchTB(); refetchIS(); refetchBS(); refetchCF(); };

  const loading = (tab === 0 && tbLoading) || (tab === 1 && isLoading) || (tab === 2 && bsLoading) || (tab === 3 && cfLoading);

  const renderAccountRows = (accounts: any[], showType = false) => (
    accounts.map((acc: any) => (
      <TableRow key={acc.account_id} hover>
        <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{acc.code}</Typography></TableCell>
        <TableCell>{acc.name}</TableCell>
        {showType && <TableCell><Chip label={acc.account_type} size="small" sx={{ bgcolor: `${TYPE_COLORS[acc.account_type]}15`, color: TYPE_COLORS[acc.account_type], fontWeight: 600, textTransform: 'capitalize' }} /></TableCell>}
        <TableCell align="right">{acc.debit > 0 ? fmt(acc.debit) : '-'}</TableCell>
        <TableCell align="right">{acc.credit > 0 ? fmt(acc.credit) : '-'}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 600, color: acc.balance >= 0 ? '#2e7d32' : '#d32f2f' }}>{fmt(acc.balance)}</TableCell>
      </TableRow>
    ))
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>Financial Reports</Typography>
          <Typography variant="body2" color="textSecondary">Generated from posted journal entries</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refetchAll}>Refresh</Button>
      </Box>

      {/* Date Filters */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField label="Start Date" type="date" size="small" value={startDate} onChange={(e) => setStartDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }} />
          <TextField label="End Date" type="date" size="small" value={endDate} onChange={(e) => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: 160 }} />
          {(startDate || endDate) && <Button size="small" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</Button>}
          <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
            {startDate || endDate ? `Showing: ${startDate || 'beginning'} to ${endDate || 'present'}` : 'Showing all time'}
          </Typography>
        </Box>
      </Paper>

      {/* Report Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Trial Balance" />
          <Tab label="Income Statement" />
          <Tab label="Balance Sheet" />
          <Tab label="Cash Flow" />
        </Tabs>
      </Paper>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}

      {/* Trial Balance */}
      {tab === 0 && !tbLoading && trialBalance && (
        <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Trial Balance</Typography>
            {trialBalance.is_balanced ? (
              <Alert severity="success" sx={{ mt: 1 }}>Books are balanced — Total Debits equal Total Credits</Alert>
            ) : (
              <Alert severity="error" sx={{ mt: 1 }}>Books are NOT balanced — difference of {fmt(Math.abs(trialBalance.total_debit - trialBalance.total_credit))}</Alert>
            )}
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Code</strong></TableCell>
                  <TableCell><strong>Account</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell align="right"><strong>Debit</strong></TableCell>
                  <TableCell align="right"><strong>Credit</strong></TableCell>
                  <TableCell align="right"><strong>Balance</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {renderAccountRows(trialBalance.accounts, true)}
                <TableRow sx={{ backgroundColor: '#e8f5e9' }}>
                  <TableCell colSpan={3}><strong>Totals</strong></TableCell>
                  <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700, color: '#2196f3' }}>{fmt(trialBalance.total_debit)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700, color: '#4caf50' }}>{fmt(trialBalance.total_credit)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700 }}>{fmt(trialBalance.total_debit - trialBalance.total_credit)}</Typography></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Income Statement */}
      {tab === 1 && !isLoading && incomeStatement && (
        <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Income Statement (Profit & Loss)</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead><TableRow sx={{ backgroundColor: '#f5f5f5' }}><TableCell><strong>Code</strong></TableCell><TableCell><strong>Account</strong></TableCell><TableCell align="right"><strong>Debit</strong></TableCell><TableCell align="right"><strong>Credit</strong></TableCell><TableCell align="right"><strong>Balance</strong></TableCell></TableRow></TableHead>
              <TableBody>
                <TableRow sx={{ backgroundColor: '#e8f5e9' }}><TableCell colSpan={5}><Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4caf50' }}>Revenue</Typography></TableCell></TableRow>
                {incomeStatement.income.map((acc: any) => (
                  <TableRow key={acc.account_id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell align="right">{acc.debit > 0 ? fmt(acc.debit) : '-'}</TableCell>
                    <TableCell align="right">{acc.credit > 0 ? fmt(acc.credit) : '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#4caf50' }}>{fmt(acc.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: '#f1f8f4' }}><TableCell colSpan={4} align="right"><strong>Total Revenue</strong></TableCell><TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#4caf50' }}>{fmt(incomeStatement.total_income)}</Typography></TableCell></TableRow>

                <TableRow sx={{ backgroundColor: '#fff3e0' }}><TableCell colSpan={5}><Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ff9800' }}>Expenses</Typography></TableCell></TableRow>
                {incomeStatement.expenses.map((acc: any) => (
                  <TableRow key={acc.account_id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell align="right">{acc.debit > 0 ? fmt(acc.debit) : '-'}</TableCell>
                    <TableCell align="right">{acc.credit > 0 ? fmt(acc.credit) : '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#ff9800' }}>{fmt(acc.balance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: '#fff8e1' }}><TableCell colSpan={4} align="right"><strong>Total Expenses</strong></TableCell><TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#ff9800' }}>{fmt(incomeStatement.total_expenses)}</Typography></TableCell></TableRow>

                <TableRow sx={{ backgroundColor: incomeStatement.net_income >= 0 ? '#e8f5e9' : '#ffebee' }}>
                  <TableCell colSpan={4} align="right"><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Net Income</Typography></TableCell>
                  <TableCell align="right"><Typography variant="h6" sx={{ fontWeight: 700, color: incomeStatement.net_income >= 0 ? '#2e7d32' : '#d32f2f' }}>{fmt(incomeStatement.net_income)}</Typography></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Balance Sheet */}
      {tab === 2 && !bsLoading && balanceSheet && (
        <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Balance Sheet</Typography>
            {balanceSheet.is_balanced ? (
              <Alert severity="success" sx={{ mt: 1 }}>Assets = Liabilities + Equity</Alert>
            ) : (
              <Alert severity="warning" sx={{ mt: 1 }}>Assets ({fmt(balanceSheet.total_assets)}) ≠ Liabilities + Equity ({fmt(balanceSheet.total_liabilities_and_equity)})</Alert>
            )}
          </Box>
          <TableContainer>
            <Table>
              <TableHead><TableRow sx={{ backgroundColor: '#f5f5f5' }}><TableCell><strong>Code</strong></TableCell><TableCell><strong>Account</strong></TableCell><TableCell align="right"><strong>Amount</strong></TableCell></TableRow></TableHead>
              <TableBody>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}><TableCell colSpan={3}><Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2196f3' }}>Assets</Typography></TableCell></TableRow>
                {balanceSheet.assets.map((acc: any) => (
                  <TableRow key={acc.account_id} hover><TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell><TableCell>{acc.name}</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(acc.balance)}</TableCell></TableRow>
                ))}
                <TableRow sx={{ backgroundColor: '#bbdefb' }}><TableCell colSpan={2} align="right"><strong>Total Assets</strong></TableCell><TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#2196f3' }}>{fmt(balanceSheet.total_assets)}</Typography></TableCell></TableRow>

                <TableRow sx={{ backgroundColor: '#ffebee' }}><TableCell colSpan={3}><Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f44336' }}>Liabilities</Typography></TableCell></TableRow>
                {balanceSheet.liabilities.map((acc: any) => (
                  <TableRow key={acc.account_id} hover><TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell><TableCell>{acc.name}</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(acc.balance)}</TableCell></TableRow>
                ))}
                <TableRow sx={{ backgroundColor: '#ffcdd2' }}><TableCell colSpan={2} align="right"><strong>Total Liabilities</strong></TableCell><TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#f44336' }}>{fmt(balanceSheet.total_liabilities)}</Typography></TableCell></TableRow>

                <TableRow sx={{ backgroundColor: '#f3e5f5' }}><TableCell colSpan={3}><Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#9c27b0' }}>Equity</Typography></TableCell></TableRow>
                {balanceSheet.equity.map((acc: any) => (
                  <TableRow key={acc.account_id} hover><TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell><TableCell>{acc.name}</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(acc.balance)}</TableCell></TableRow>
                ))}
                <TableRow hover><TableCell><Typography variant="body2" sx={{ pl: 2, fontStyle: 'italic' }}>—</Typography></TableCell><TableCell sx={{ fontStyle: 'italic' }}>Retained Earnings</TableCell><TableCell align="right" sx={{ fontWeight: 600, fontStyle: 'italic' }}>{fmt(balanceSheet.retained_earnings)}</TableCell></TableRow>
                <TableRow sx={{ backgroundColor: '#e1bee7' }}><TableCell colSpan={2} align="right"><strong>Total Equity</strong></TableCell><TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#9c27b0' }}>{fmt(balanceSheet.total_equity_with_retained)}</Typography></TableCell></TableRow>

                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell colSpan={2} align="right"><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Total Liabilities + Equity</Typography></TableCell>
                  <TableCell align="right"><Typography variant="h6" sx={{ fontWeight: 700 }}>{fmt(balanceSheet.total_liabilities_and_equity)}</Typography></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Cash Flow */}
      {tab === 3 && !cfLoading && cashFlow && (
        <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Cash Flow Statement</Typography>
          </Box>

          {/* Summary */}
          <Box sx={{ display: 'flex', gap: 3, p: 2, flexWrap: 'wrap' }}>
            <Paper sx={{ p: 2, flex: '1 1 200px', borderRadius: 2, bgcolor: '#e8f5e9' }}>
              <Typography variant="caption" color="textSecondary">Total Inflow</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>{fmt(cashFlow.total_inflow)}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: '1 1 200px', borderRadius: 2, bgcolor: '#ffebee' }}>
              <Typography variant="caption" color="textSecondary">Total Outflow</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#d32f2f' }}>{fmt(cashFlow.total_outflow)}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: '1 1 200px', borderRadius: 2, bgcolor: cashFlow.net_change >= 0 ? '#e8f5e9' : '#ffebee' }}>
              <Typography variant="caption" color="textSecondary">Net Change</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: cashFlow.net_change >= 0 ? '#2e7d32' : '#d32f2f' }}>{fmt(cashFlow.net_change)}</Typography>
            </Paper>
          </Box>

          {cashFlow.cash_accounts.map((account: any) => (
            <Box key={account.account_id}>
              <Box onClick={() => setExpandedCash(expandedCash === account.account_id ? null : account.account_id)}
                sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderTop: '1px solid #eee', '&:hover': { bgcolor: '#fafafa' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconButton size="small">{expandedCash === account.account_id ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{account.account_code}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{account.account_name}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 3 }}>
                  <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="textSecondary">In</Typography><Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600 }}>{fmt(account.inflow)}</Typography></Box>
                  <Box sx={{ textAlign: 'right' }}><Typography variant="caption" color="textSecondary">Out</Typography><Typography variant="body2" sx={{ color: '#d32f2f', fontWeight: 600 }}>{fmt(account.outflow)}</Typography></Box>
                  <Box sx={{ textAlign: 'right', minWidth: 80 }}><Typography variant="caption" color="textSecondary">Net</Typography><Typography variant="body2" sx={{ fontWeight: 700, color: account.net_change >= 0 ? '#2e7d32' : '#d32f2f' }}>{fmt(account.net_change)}</Typography></Box>
                </Box>
              </Box>
              <Collapse in={expandedCash === account.account_id} timeout="auto" unmountOnExit>
                <TableContainer sx={{ px: 2, pb: 2 }}>
                  <Table size="small">
                    <TableHead><TableRow sx={{ backgroundColor: '#f5f5f5' }}><TableCell><strong>Date</strong></TableCell><TableCell><strong>Entry</strong></TableCell><TableCell><strong>Description</strong></TableCell><TableCell><strong>Type</strong></TableCell><TableCell align="right"><strong>Inflow</strong></TableCell><TableCell align="right"><strong>Outflow</strong></TableCell><TableCell align="right"><strong>Net</strong></TableCell></TableRow></TableHead>
                    <TableBody>
                      {account.transactions.map((t: any, i: number) => (
                        <TableRow key={i} hover>
                          <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                          <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{t.entry_number}</Typography></TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell><Chip label={t.reference_type || 'manual'} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} /></TableCell>
                          <TableCell align="right" sx={{ color: t.inflow > 0 ? '#2e7d32' : 'text.secondary' }}>{t.inflow > 0 ? fmt(t.inflow) : '-'}</TableCell>
                          <TableCell align="right" sx={{ color: t.outflow > 0 ? '#d32f2f' : 'text.secondary' }}>{t.outflow > 0 ? fmt(t.outflow) : '-'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: t.net >= 0 ? '#2e7d32' : '#d32f2f' }}>{fmt(t.net)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Collapse>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
};

export default FinancialReports;
