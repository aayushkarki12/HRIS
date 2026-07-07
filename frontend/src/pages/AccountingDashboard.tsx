import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, Divider, Skeleton, Chip,
  List, ListItem, ListItemText, ListItemIcon,
} from '@mui/material';
import {
  RequestPage as InvoiceIcon,
  Receipt as ExpenseIcon,
  Payments as PayrollIcon,
  AccountBalance as LedgerIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { accountingService, invoiceService, expenseService, payrollService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.22, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const StatCardSkeleton: React.FC = () => (
  <Card sx={{ borderRadius: 2 }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton width={100} height={14} sx={{ mb: 1 }} />
          <Skeleton width={90} height={40} sx={{ mb: 0.5 }} />
          <Skeleton width={80} height={12} />
        </Box>
        <Skeleton variant="rounded" width={48} height={48} sx={{ borderRadius: 2 }} />
      </Box>
    </CardContent>
  </Card>
);

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      bgcolor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px',
      px: 1.5, py: 1, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      {label && <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.25, color: '#475569' }}>{label}</Typography>}
      {payload.map((p: any) => (
        <Typography key={p.name} variant="caption" sx={{ display: 'block', color: p.color || '#0F172A', fontWeight: 500 }}>
          {p.name}: <strong>${Number(p.value).toLocaleString()}</strong>
        </Typography>
      ))}
    </Box>
  );
};

const ChartPanel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; index: number; minHeight?: number }> =
  ({ title, subtitle, children, index, minHeight = 220 }) => (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible" style={{ height: '100%' }}>
      <Box sx={{
        p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
        boxShadow: 'none', bgcolor: '#fff', height: '100%', display: 'flex', flexDirection: 'column',
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>}
        {!subtitle && <Box sx={{ mb: 2 }} />}
        <Box sx={{ flex: 1, minHeight }}>{children}</Box>
      </Box>
    </motion.div>
  );

const StatCard: React.FC<{ title: string; value: string | number; subtitle?: string; icon: any; color: string; bgColor: string; index: number; path?: string }> =
  ({ title, value, subtitle, icon: Icon, color, bgColor, index, path }) => {
    const navigate = useNavigate();
    return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
      <Card
        onClick={path ? () => navigate(path) : undefined}
        sx={{
          borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none',
          transition: 'box-shadow 0.15s, transform 0.15s',
          cursor: path ? 'pointer' : 'default',
          '&:hover': path ? { boxShadow: 3, transform: 'translateY(-2px)', borderColor: 'primary.main' } : { boxShadow: 3, transform: 'translateY(-2px)' },
        }}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'text.secondary', fontSize: '0.675rem',
              }}>
                {title}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.75, mb: 0.5, letterSpacing: '-0.03em', lineHeight: 1 }} noWrap>
                {value}
              </Typography>
              {subtitle && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>}
            </Box>
            <Box sx={{ p: 1.25, borderRadius: '10px', bgcolor: bgColor, display: 'flex', flexShrink: 0 }}>
              <Icon sx={{ color, fontSize: 22 }} />
            </Box>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
    );
  };

const money = (n: number) => `$${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const AccountingDashboard: React.FC = () => {
  const { isManager, user } = useAuth();

  const { data: invoiceStats, isLoading: invLoading } = useQuery({
    queryKey: ['invoices', 'stats'], queryFn: invoiceService.getStats, enabled: isManager, retry: 1,
  });

  const { data: ledgerSummary, isLoading: ledgerLoading } = useQuery({
    queryKey: ['accounting', 'ledger-summary'], queryFn: () => accountingService.getLedgerSummary(), enabled: isManager, retry: 1,
  });

  const { data: pendingExpenses = [], isLoading: expLoading } = useQuery({
    queryKey: ['expenses', 'pending'], queryFn: expenseService.getPending, enabled: isManager, retry: 1,
  });

  const { data: payrollRuns = [], isLoading: payrollLoading } = useQuery({
    queryKey: ['payroll', 'runs'], queryFn: payrollService.getPayrollRuns, enabled: isManager, retry: 1,
  });

  const isLoading = invLoading || ledgerLoading || expLoading || payrollLoading;

  const income = ledgerSummary?.income?.balance ?? ledgerSummary?.revenue?.balance ?? 0;
  const expensesTotal = ledgerSummary?.expense?.balance ?? 0;
  const netIncome = income - expensesTotal;

  const pendingExpenseTotal = useMemo(
    () => pendingExpenses.reduce((sum: number, e: any) => sum + (e.total_amount ?? 0), 0),
    [pendingExpenses]
  );

  const latestPayrollRun = payrollRuns[0];

  const ledgerChartData = useMemo(() => {
    if (!ledgerSummary) return [];
    const colors: Record<string, string> = {
      asset: '#4F46E5', liability: '#DC2626', equity: '#0891B2',
      income: '#16A34A', revenue: '#16A34A', expense: '#D97706',
    };
    return Object.entries(ledgerSummary)
      .filter(([, v]: any) => typeof v?.balance === 'number')
      .map(([type, v]: any) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: Math.abs(v.balance),
        fill: colors[type] ?? '#94A3B8',
      }))
      .filter(d => d.value > 0);
  }, [ledgerSummary]);

  const invoiceStatusData = useMemo(() => {
    if (!invoiceStats?.by_status) return [];
    const colors: Record<string, string> = {
      paid: '#16A34A', sent: '#4F46E5', overdue: '#DC2626',
      partially_paid: '#D97706', draft: '#94A3B8', cancelled: '#CBD5E1',
    };
    return Object.entries(invoiceStats.by_status).map(([name, value]: any) => ({
      name, value, color: colors[name] ?? '#94A3B8',
    }));
  }, [invoiceStats]);

  if (!isManager) {
    return <AccessDenied />;
  }

  const stats = [
    { title: 'Total Invoiced', value: money(invoiceStats?.total_amount ?? 0), icon: InvoiceIcon, color: '#4F46E5', bgColor: '#EEF2FF', subtitle: `${invoiceStats?.total_invoices ?? 0} invoices`, path: '/invoices' },
    { title: 'Outstanding', value: money(invoiceStats?.outstanding ?? 0), icon: TrendingDownIcon, color: '#DC2626', bgColor: '#FEF2F2', subtitle: 'Awaiting payment', path: '/invoices' },
    { title: 'Pending Expense Claims', value: money(pendingExpenseTotal), icon: ExpenseIcon, color: '#D97706', bgColor: '#FFFBEB', subtitle: `${pendingExpenses.length} claim(s)`, path: '/expense-claims' },
    { title: 'Latest Payroll Run', value: latestPayrollRun ? money(latestPayrollRun.total_net) : '—', icon: PayrollIcon, color: '#0891B2', bgColor: '#ECFEFF', subtitle: latestPayrollRun ? latestPayrollRun.status : 'No runs yet', path: '/payroll' },
  ];

  return (
    <Box>
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            Accounting Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Financial health at a glance — invoices, expenses, payroll, and the general ledger
          </Typography>
        </Box>
      </motion.div>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        gap: 2, mb: 3,
      }}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat, i) => <StatCard key={stat.title} index={i + 1} {...stat} />)}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <ChartPanel title="Net Income" subtitle="Income vs. expenses (posted entries)" index={5} minHeight={180}>
          {isLoading ? <Skeleton height={160} /> : (
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: netIncome >= 0 ? '#16A34A' : '#DC2626', mb: 0.5 }}
              >
                {money(netIncome)}
              </Typography>
              <Typography variant="caption" color="text.secondary">Net income this period</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <TrendingUpIcon sx={{ fontSize: 16, color: '#16A34A' }} />
                  <Typography variant="caption" color="text.secondary">Income</Typography>
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{money(income)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <TrendingDownIcon sx={{ fontSize: 16, color: '#D97706' }} />
                  <Typography variant="caption" color="text.secondary">Expenses</Typography>
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{money(expensesTotal)}</Typography>
              </Box>
            </Box>
          )}
        </ChartPanel>

        <ChartPanel title="General Ledger Summary" subtitle="Balances by account type" index={6} minHeight={180}>
          {isLoading ? <Skeleton height={160} /> : ledgerChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={ledgerChartData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <ReTooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="value" name="Balance" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {ledgerChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Box sx={{ textAlign: 'center' }}>
                <LedgerIcon sx={{ fontSize: 36, color: '#E2E8F0', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No posted journal entries yet</Typography>
              </Box>
            </Box>
          )}
        </ChartPanel>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <ChartPanel title="Invoices by Status" subtitle={`${invoiceStats?.total_invoices ?? 0} total invoices`} index={7} minHeight={200}>
          {isLoading ? <Skeleton variant="circular" width={140} height={140} sx={{ mx: 'auto' }} /> : invoiceStatusData.length > 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={invoiceStatusData} cx="50%" cy="50%" innerRadius={44} outerRadius={66}
                    dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                    {invoiceStatusData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ flex: 1 }}>
                {invoiceStatusData.map(d => (
                  <Box key={d.name} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{d.name.replace('_', ' ')}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{d.value as number}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Typography variant="body2" color="text.secondary">No invoices yet</Typography>
            </Box>
          )}
        </ChartPanel>

        <ChartPanel title="Pending Expense Claims" subtitle={`${pendingExpenses.length} awaiting approval`} index={8} minHeight={200}>
          {isLoading ? <Skeleton height={180} /> : pendingExpenses.length > 0 ? (
            <List dense disablePadding>
              {pendingExpenses.slice(0, 6).map((e: any) => (
                <ListItem key={e.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><ScheduleIcon sx={{ fontSize: 18, color: '#D97706' }} /></ListItemIcon>
                  <ListItemText
                    primary={`${e.employee?.first_name ?? ''} ${e.employee?.last_name ?? ''}`.trim() || 'Expense claim'}
                    secondary={money(e.total_amount)}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  <Chip label={e.status} size="small" color="warning" sx={{ textTransform: 'capitalize' }} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Typography variant="body2" color="text.secondary">Nothing pending</Typography>
            </Box>
          )}
        </ChartPanel>
      </Box>
    </Box>
  );
};

export default AccountingDashboard;
