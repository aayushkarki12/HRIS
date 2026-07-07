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
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_COLORS: Record<string, string> = {
  asset: '#2196f3', liability: '#f44336', equity: '#9c27b0', income: '#4caf50', expense: '#ff9800',
};

const BUCKET_COLORS: Record<string, string> = {
  current: '#4caf50', '1-30': '#8bc34a', '31-60': '#ff9800', '61-90': '#ff5722', '90+': '#f44336',
};

// Groups a flat account-balance list by ledger group, preserving each group's own account order.
// Accounts with no ledger_group_name assigned are bucketed under "Ungrouped" at the end. The
// caller only renders a sub-header per group when `showHeaders` comes back true, so a tenant
// that hasn't set up any ledger groups still sees exactly the old flat list under one header.
const groupByLedgerGroup = (accounts: any[]) => {
  const groups = new Map<string, any[]>();
  for (const acc of accounts) {
    const key = acc.ledger_group_name || 'Ungrouped';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(acc);
  }
  const entries = Array.from(groups.entries());
  entries.sort((a, b) => (a[0] === 'Ungrouped' ? 1 : b[0] === 'Ungrouped' ? -1 : a[0].localeCompare(b[0])));
  const showHeaders = entries.some(([name]) => name !== 'Ungrouped') && entries.length > 1;
  return { entries, showHeaders };
};

const FinancialReports: React.FC = () => {
  const { isManager } = useAuth();
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

  const { data: receivables, isLoading: arLoading, refetch: refetchAR } = useQuery({
    queryKey: ['receivablesAging'],
    queryFn: () => accountingService.getReceivablesAging(),
    enabled: tab === 4,
  });

  const { data: payables, isLoading: apLoading, refetch: refetchAP } = useQuery({
    queryKey: ['payablesAging'],
    queryFn: () => accountingService.getPayablesAging(),
    enabled: tab === 5,
  });

  const refetchAll = () => { refetchTB(); refetchIS(); refetchBS(); refetchCF(); refetchAR(); refetchAP(); };

  const loading = (tab === 0 && tbLoading) || (tab === 1 && isLoading) || (tab === 2 && bsLoading)
    || (tab === 3 && cfLoading) || (tab === 4 && arLoading) || (tab === 5 && apLoading);

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

  const emptyGroup = { entries: [] as [string, any[]][], showHeaders: false };
  const groupedIncome = incomeStatement ? groupByLedgerGroup(incomeStatement.income) : emptyGroup;
  const groupedExpenses = incomeStatement ? groupByLedgerGroup(incomeStatement.expenses) : emptyGroup;
  const groupedAssets = balanceSheet ? groupByLedgerGroup(balanceSheet.assets) : emptyGroup;
  const groupedLiabilities = balanceSheet ? groupByLedgerGroup(balanceSheet.liabilities) : emptyGroup;

  if (!isManager) {
    return <AccessDenied />;
  }

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
          <Tab label="Receivables" />
          <Tab label="Payables" />
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
                {groupedIncome.entries.map(([groupName, accs]) => (
                  <React.Fragment key={groupName}>
                    {groupedIncome.showHeaders && (
                      <TableRow><TableCell colSpan={5} sx={{ py: 0.5, borderBottom: 0 }}><Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', pl: 1 }}>{groupName}</Typography></TableCell></TableRow>
                    )}
                    {accs.map((acc: any) => (
                      <TableRow key={acc.account_id} hover>
                        <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell>
                        <TableCell>{acc.name}</TableCell>
                        <TableCell align="right">{acc.debit > 0 ? fmt(acc.debit) : '-'}</TableCell>
                        <TableCell align="right">{acc.credit > 0 ? fmt(acc.credit) : '-'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#4caf50' }}>{fmt(acc.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
                <TableRow sx={{ backgroundColor: '#f1f8f4' }}><TableCell colSpan={4} align="right"><strong>Total Revenue</strong></TableCell><TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#4caf50' }}>{fmt(incomeStatement.total_income)}</Typography></TableCell></TableRow>

                <TableRow sx={{ backgroundColor: '#fff3e0' }}><TableCell colSpan={5}><Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ff9800' }}>Expenses</Typography></TableCell></TableRow>
                {groupedExpenses.entries.map(([groupName, accs]) => (
                  <React.Fragment key={groupName}>
                    {groupedExpenses.showHeaders && (
                      <TableRow><TableCell colSpan={5} sx={{ py: 0.5, borderBottom: 0 }}><Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', pl: 1 }}>{groupName}</Typography></TableCell></TableRow>
                    )}
                    {accs.map((acc: any) => (
                      <TableRow key={acc.account_id} hover>
                        <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell>
                        <TableCell>{acc.name}</TableCell>
                        <TableCell align="right">{acc.debit > 0 ? fmt(acc.debit) : '-'}</TableCell>
                        <TableCell align="right">{acc.credit > 0 ? fmt(acc.credit) : '-'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: '#ff9800' }}>{fmt(acc.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
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
                {groupedAssets.entries.map(([groupName, accs]) => (
                  <React.Fragment key={groupName}>
                    {groupedAssets.showHeaders && (
                      <TableRow><TableCell colSpan={3} sx={{ py: 0.5, borderBottom: 0 }}><Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', pl: 1 }}>{groupName}</Typography></TableCell></TableRow>
                    )}
                    {accs.map((acc: any) => (
                      <TableRow key={acc.account_id} hover><TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell><TableCell>{acc.name}</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(acc.balance)}</TableCell></TableRow>
                    ))}
                  </React.Fragment>
                ))}
                <TableRow sx={{ backgroundColor: '#bbdefb' }}><TableCell colSpan={2} align="right"><strong>Total Assets</strong></TableCell><TableCell align="right"><Typography sx={{ fontWeight: 700, color: '#2196f3' }}>{fmt(balanceSheet.total_assets)}</Typography></TableCell></TableRow>

                <TableRow sx={{ backgroundColor: '#ffebee' }}><TableCell colSpan={3}><Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f44336' }}>Liabilities</Typography></TableCell></TableRow>
                {groupedLiabilities.entries.map(([groupName, accs]) => (
                  <React.Fragment key={groupName}>
                    {groupedLiabilities.showHeaders && (
                      <TableRow><TableCell colSpan={3} sx={{ py: 0.5, borderBottom: 0 }}><Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', pl: 1 }}>{groupName}</Typography></TableCell></TableRow>
                    )}
                    {accs.map((acc: any) => (
                      <TableRow key={acc.account_id} hover><TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, pl: 2 }}>{acc.code}</Typography></TableCell><TableCell>{acc.name}</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(acc.balance)}</TableCell></TableRow>
                    ))}
                  </React.Fragment>
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

      {/* Receivables Aging */}
      {tab === 4 && !arLoading && receivables && (
        <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Accounts Receivable Aging</Typography>
            <Typography variant="body2" color="textSecondary">Outstanding customer invoices as of {receivables.as_of}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, p: 2, flexWrap: 'wrap' }}>
            {Object.entries(receivables.buckets).map(([bucket, amount]: any) => (
              <Paper key={bucket} sx={{ p: 2, flex: '1 1 140px', borderRadius: 2, bgcolor: `${BUCKET_COLORS[bucket]}15` }}>
                <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'capitalize' }}>{bucket === 'current' ? 'Current' : `${bucket} days`}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: BUCKET_COLORS[bucket] }}>{fmt(amount)}</Typography>
              </Paper>
            ))}
            <Paper sx={{ p: 2, flex: '1 1 140px', borderRadius: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="caption" color="textSecondary">Total Outstanding</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{fmt(receivables.total_outstanding)}</Typography>
            </Paper>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Invoice #</strong></TableCell>
                  <TableCell><strong>Customer</strong></TableCell>
                  <TableCell><strong>Due Date</strong></TableCell>
                  <TableCell align="right"><strong>Total</strong></TableCell>
                  <TableCell align="right"><strong>Paid</strong></TableCell>
                  <TableCell align="right"><strong>Outstanding</strong></TableCell>
                  <TableCell><strong>Aging</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receivables.invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No outstanding receivables</Typography></TableCell></TableRow>
                ) : receivables.invoices.map((inv: any) => (
                  <TableRow key={inv.invoice_id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.invoice_number}</Typography></TableCell>
                    <TableCell>{inv.customer_name}</TableCell>
                    <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                    <TableCell align="right">{fmt(inv.total_amount)}</TableCell>
                    <TableCell align="right">{fmt(inv.amount_paid)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(inv.outstanding)}</TableCell>
                    <TableCell>
                      <Chip
                        label={inv.bucket === 'current' ? 'Current' : `${inv.bucket} days`}
                        size="small"
                        sx={{ bgcolor: `${BUCKET_COLORS[inv.bucket]}15`, color: BUCKET_COLORS[inv.bucket], fontWeight: 600 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Payables Aging */}
      {tab === 5 && !apLoading && payables && (
        <Paper sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Accounts Payable Aging</Typography>
            <Typography variant="body2" color="textSecondary">
              Accounting-approved, unpaid expense claims as of {payables.as_of} — this system tracks payables through expense claim reimbursements rather than a separate vendor-bill ledger
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, p: 2, flexWrap: 'wrap' }}>
            {Object.entries(payables.buckets).map(([bucket, amount]: any) => (
              <Paper key={bucket} sx={{ p: 2, flex: '1 1 140px', borderRadius: 2, bgcolor: `${BUCKET_COLORS[bucket]}15` }}>
                <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'capitalize' }}>{bucket === 'current' ? 'Current' : `${bucket} days`}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: BUCKET_COLORS[bucket] }}>{fmt(amount)}</Typography>
              </Paper>
            ))}
            <Paper sx={{ p: 2, flex: '1 1 140px', borderRadius: 2, bgcolor: '#f5f5f5' }}>
              <Typography variant="caption" color="textSecondary">Total Outstanding</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{fmt(payables.total_outstanding)}</Typography>
            </Paper>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><strong>Claim #</strong></TableCell>
                  <TableCell><strong>Employee</strong></TableCell>
                  <TableCell><strong>Approved</strong></TableCell>
                  <TableCell align="right"><strong>Amount</strong></TableCell>
                  <TableCell><strong>Aging</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payables.claims.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No outstanding payables</Typography></TableCell></TableRow>
                ) : payables.claims.map((claim: any) => (
                  <TableRow key={claim.claim_id} hover>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{claim.claim_number}</Typography></TableCell>
                    <TableCell>{claim.employee_name || '-'}</TableCell>
                    <TableCell>{new Date(claim.approved_date).toLocaleDateString()}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{fmt(claim.amount)}</TableCell>
                    <TableCell>
                      <Chip
                        label={claim.bucket === 'current' ? 'Current' : `${claim.bucket} days`}
                        size="small"
                        sx={{ bgcolor: `${BUCKET_COLORS[claim.bucket]}15`, color: BUCKET_COLORS[claim.bucket], fontWeight: 600 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default FinancialReports;
