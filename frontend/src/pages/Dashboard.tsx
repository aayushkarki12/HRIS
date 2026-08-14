import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, Divider, Skeleton,
  Alert, LinearProgress, Chip, List, ListItem, ListItemText, ListItemIcon, Button,
  Dialog, DialogTitle, DialogContent, Tabs, Tab,
} from '@mui/material';
import {
  People as PeopleIcon,
  Computer as ComputerIcon,
  Folder as FolderIcon,
  Assignment as AssignmentIcon,
  EventNote as LeaveIcon,
  Inventory as ResourceRequestIcon,
  AccessTime as AttendanceIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Circle as CircleIcon,
  TrendingUp as TrendingUpIcon,
  PersonAdd as PersonAddIcon,
  Payments as PayrollIcon,
  RequestPage as InvoiceIcon,
  Receipt as ExpenseIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import {
  employeeService, resourceService, projectService, assignmentService,
  leaveService, attendanceService, auditLogService, getErrorMessage,
} from '../services/api';
import { alpha } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.22, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";

// ─── Shared building blocks ───────────────────────────────────────────────────
const StatCardSkeleton: React.FC = () => (
  <Card sx={{ height: '100%', borderRadius: 2 }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton width={100} height={14} sx={{ mb: 1 }} />
          <Skeleton width={60} height={40} sx={{ mb: 0.5 }} />
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
          {p.name}: <strong>{p.value}</strong>
        </Typography>
      ))}
    </Box>
  );
};

const ChartPanel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; index: number; minHeight?: number }> =
  ({ title, subtitle, children, index, minHeight = 220 }) => (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible" style={{ height: '100%' }}>
      <Box sx={{
        p: 2.5, borderRadius: 3, border: 'none',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)', bgcolor: '#fff', height: '100%', display: 'flex', flexDirection: 'column',
      }}>
        <Typography sx={{ fontFamily: SERIF, fontWeight: 700, fontSize: '1.0625rem', color: '#0F172A', mb: subtitle ? 0.25 : 0 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        <Divider sx={{ mt: 1.5, mb: 2 }} />
        <Box sx={{ flex: 1, minHeight }}>{children}</Box>
      </Box>
    </motion.div>
  );

const LegendRow: React.FC<{ color: string; label: string; value: number; max: number }> = ({ color, label, value, max }) => (
  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, mb: 1, '&:last-child': { mb: 0 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>{label}</Typography>
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={max > 0 ? (value / max) * 100 : 0}
      sx={{ height: 4, borderRadius: 2, bgcolor: '#F1F5F9', '& .MuiLinearProgress-bar': { bgcolor: color } }}
    />
  </Box>
);

const StatCard: React.FC<{ title: string; value: number | string; subtitle?: string; trend?: string; icon: any; color: string; bgColor: string; index: number; path?: string; onClick?: () => void }> =
  ({ title, value, subtitle, trend, icon: Icon, color, bgColor, index, path, onClick }) => {
    const navigate = useNavigate();
    const handleClick = onClick ?? (path ? () => navigate(path) : undefined);
    return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible" style={{ height: '100%' }}>
      <Card
        onClick={handleClick}
        sx={{
          height: '100%', display: 'flex', flexDirection: 'column',
          borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none',
          transition: 'box-shadow 0.15s, transform 0.15s',
          cursor: handleClick ? 'pointer' : 'default',
          '&:hover': handleClick ? { boxShadow: 3, transform: 'translateY(-2px)', borderColor: 'primary.main' } : { boxShadow: 3, transform: 'translateY(-2px)' },
        }}
      >
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'text.secondary', fontSize: '0.675rem',
              }}>
                {title}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.75, mb: 0.5, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {value}
              </Typography>
              {trend && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mb: subtitle ? 0.25 : 0 }}>
                  <TrendingUpIcon sx={{ fontSize: 13, color: '#16A34A' }} />
                  <Typography variant="caption" sx={{ color: '#16A34A', fontWeight: 700 }}>{trend}</Typography>
                </Box>
              )}
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

// ─── Recent activity feed ─────────────────────────────────────────────────────
const ACTIVITY_ICONS: Record<string, any> = {
  leave: LeaveIcon,
  attendance: AttendanceIcon,
  employee: PersonAddIcon,
  payroll_run: PayrollIcon,
  salary_structure: PayrollIcon,
  invoice: InvoiceIcon,
  expense_claim: ExpenseIcon,
  resource_request: ResourceRequestIcon,
  journal_entry: PayrollIcon,
  account: PayrollIcon,
};

const ACTIVITY_COLORS: Record<string, string> = {
  approve: '#16A34A', manager_approve: '#16A34A', accounting_approve: '#16A34A',
  reject: '#DC2626', cancel: '#DC2626', deactivate: '#DC2626',
  create: '#334155', process: '#334155', post: '#334155',
  pay: '#16A34A', record_payment: '#16A34A', send: '#64748B', check_in: '#64748B',
};

const activityLabel = (log: any): string => {
  if (log.details) return log.details;
  const actorName = log.user ? `${log.user.first_name ?? ''} ${log.user.last_name ?? ''}`.trim() || log.user.username : 'Someone';
  return `${actorName} ${log.action.replace('_', ' ')}d ${log.entity_type.replace('_', ' ')}`;
};

const timeAgo = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const RecentActivity: React.FC<{ index: number }> = ({ index }) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', 'recent'], queryFn: () => auditLogService.getRecent(8), retry: 1,
  });

  return (
    <ChartPanel title="Recent Activity" subtitle="Latest actions across the company" index={index} minHeight={240}>
      {isLoading ? <Skeleton height={220} /> : logs.length > 0 ? (
        <List dense disablePadding>
          {logs.map((log: any) => {
            const Icon = ACTIVITY_ICONS[log.entity_type] ?? HistoryIcon;
            const color = ACTIVITY_COLORS[log.action] ?? '#64748B';
            return (
              <ListItem key={log.id} disablePadding sx={{ py: 0.6 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <Box sx={{ p: 0.5, borderRadius: '8px', bgcolor: `${color}1A`, display: 'flex' }}>
                    <Icon sx={{ fontSize: 15, color }} />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={activityLabel(log)}
                  secondary={timeAgo(log.created_at)}
                  primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: '0.7rem' }}
                />
              </ListItem>
            );
          })}
        </List>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
          <Box sx={{ textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 36, color: '#E2E8F0', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No recent activity</Typography>
          </Box>
        </Box>
      )}
    </ChartPanel>
  );
};

// ─── Activity trend (last 14 days) ────────────────────────────────────────────
const ActivityTrend: React.FC<{ index: number }> = ({ index }) => {
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 13);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', 'trend', fmt(startDate), fmt(endDate)],
    queryFn: () => auditLogService.getAll({ start_date: fmt(startDate), end_date: fmt(endDate), limit: 1000 }),
    retry: 1,
  });

  const trendData = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = fmt(d);
      days.push({ date: key, label: key.slice(5), count: 0 });
    }
    const byDate = new Map(days.map(d => [d.date, d]));
    (logs as any[]).forEach((log: any) => {
      const bucket = byDate.get((log.created_at || '').slice(0, 10));
      if (bucket) bucket.count += 1;
    });
    return days;
  }, [logs]);

  return (
    <ChartPanel title="Activity Trend" subtitle="Last 14 days" index={index} minHeight={190}>
      {isLoading ? <Skeleton height={180} /> : (
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={trendData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F172A" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <ReTooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="count" name="Actions" stroke="#0F172A" strokeWidth={2} fill="url(#activityGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartPanel>
  );
};

// ─── Admin / manager dashboard ────────────────────────────────────────────────
const AdminDashboard: React.FC<{ userFirstName?: string }> = ({ userFirstName }) => {
  const { data: employees = [], isLoading: empLoading, error: empError } =
    useQuery({ queryKey: ['employees'], queryFn: () => employeeService.getAll(), retry: 1 });

  const { data: resources = [], isLoading: resLoading } =
    useQuery({ queryKey: ['resources'], queryFn: resourceService.getAll, retry: 1 });

  const { data: projects = [], isLoading: projLoading } =
    useQuery({ queryKey: ['projects'], queryFn: projectService.getAll, retry: 1 });

  const { data: assignments, isLoading: assignLoading } = useQuery({
    queryKey: ['assignments'], queryFn: assignmentService.getAll, retry: 1,
  });

  const { data: pendingLeaves = [], isLoading: leaveLoading } = useQuery({
    queryKey: ['leaves', 'pending'], queryFn: leaveService.getPending, retry: 1,
  });

  const { data: pendingResourceRequests = [], isLoading: reqLoading } = useQuery({
    queryKey: ['resource-requests', 'pending'], queryFn: () => resourceService.getRequests('pending'), retry: 1,
  });

  const { data: attendanceOverview, isLoading: attLoading } = useQuery({
    queryKey: ['attendance', 'today-overview'], queryFn: attendanceService.getTodayOverview, retry: 1,
  });

  // Separate from attendanceOverview on purpose - today-overview is scoped
  // to Attendance.date === today, which misses a shift that started
  // yesterday and is still open (no fixed clock-out time here, shifts can
  // run past midnight).
  const { data: longShifts, isLoading: longShiftsLoading } = useQuery({
    queryKey: ['attendance', 'long-shifts'], queryFn: attendanceService.getLongShifts, retry: 1,
    refetchInterval: 5 * 60 * 1000,
  });

  const isLoading = empLoading || resLoading || projLoading || assignLoading || leaveLoading || reqLoading || attLoading;
  const longShiftEmployees = longShifts?.employees ?? [];

  const totalEmployees   = employees.length;
  const activeEmployees  = employees.filter((e: any) => e.is_active).length;
  const availableRes     = resources.filter((r: any) => r.status === 'available').length;
  const assignedRes      = resources.filter((r: any) => r.status === 'assigned').length;
  const maintenanceRes   = resources.filter((r: any) => r.status === 'maintenance').length;
  const totalResources   = resources.length;
  const activeProjects   = projects.filter((p: any) => p.status === 'active').length;
  const completedProjects= projects.filter((p: any) => p.status === 'completed').length;
  const onHoldProjects   = projects.filter((p: any) => p.status === 'on-hold').length;
  const totalProjects    = projects.length;
  const activeAssignments= assignments?.filter((a: any) => a.status === 'active').length ?? 0;

  const empStatusData = [
    { name: 'Active',   value: activeEmployees,               color: '#16A34A' },
    { name: 'Inactive', value: totalEmployees - activeEmployees, color: '#E2E8F0' },
  ].filter(d => d.value > 0);

  const deptData = useMemo(() => {
    const map: Record<string, number> = {};
    (employees as any[]).forEach((e: any) => {
      const d = e.department || 'Other';
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.length > 12 ? name.slice(0, 11) + '…' : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [employees]);

  const resStatusData = [
    { name: 'Available',   value: availableRes,   color: '#16A34A' },
    { name: 'Assigned',    value: assignedRes,    color: '#4F46E5' },
    { name: 'Maintenance', value: maintenanceRes, color: '#D97706' },
  ].filter(d => d.value > 0);

  const projStatusData = [
    { name: 'Active',    count: activeProjects,    fill: '#4F46E5' },
    { name: 'Completed', count: completedProjects, fill: '#16A34A' },
    { name: 'On Hold',   count: onHoldProjects,    fill: '#D97706' },
    { name: 'Cancelled', count: projects.filter((p: any) => p.status === 'cancelled').length, fill: '#94A3B8' },
  ].filter(d => d.count > 0);

  const totalActive = attendanceOverview?.total_active_employees ?? 0;
  const checkedInNow = attendanceOverview?.checked_in_now ?? 0;
  const checkedOutCount = attendanceOverview?.checked_out ?? 0;
  const notCheckedInCount = attendanceOverview?.not_checked_in ?? 0;
  const checkedInEmployees = attendanceOverview?.checked_in_employees ?? [];
  const checkedOutEmployees = attendanceOverview?.checked_out_employees ?? [];
  const notCheckedInEmployees = attendanceOverview?.not_checked_in_employees ?? [];
  const missedShiftEmployees = attendanceOverview?.missed_shift_employees ?? [];
  const [onlineDialogOpen, setOnlineDialogOpen] = useState(false);
  const [attendanceTab, setAttendanceTab] = useState<'online' | 'checked_out' | 'not_checked_in'>('online');

  const now = new Date();
  const newEmployeesThisMonth = (employees as any[]).filter((e: any) => {
    const joined = e.joining_date ? new Date(e.joining_date) : null;
    return joined && joined.getMonth() === now.getMonth() && joined.getFullYear() === now.getFullYear();
  }).length;
  const newProjectsThisMonth = (projects as any[]).filter((p: any) => {
    const created = p.created_at ? new Date(p.created_at) : null;
    return created && created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { title: 'Total Employees', value: totalEmployees, icon: PeopleIcon, color: '#334155', bgColor: '#F1F5F9', subtitle: `${activeEmployees} active`, trend: newEmployeesThisMonth > 0 ? `+${newEmployeesThisMonth} this month` : undefined, path: '/employees' },
    { title: 'Pending Leave Requests', value: pendingLeaves.length, icon: LeaveIcon, color: '#D97706', bgColor: '#FFFBEB', subtitle: 'Awaiting your decision', path: '/leaves' },
    { title: 'Pending Resource Requests', value: pendingResourceRequests.length, icon: ResourceRequestIcon, color: '#DC2626', bgColor: '#FEF2F2', subtitle: 'Awaiting your decision', path: '/resources?tab=requests' },
    { title: "Today's Attendance", value: `${checkedInNow}/${totalActive}`, icon: AttendanceIcon, color: '#64748B', bgColor: '#F1F5F9', subtitle: `${checkedInNow} online · ${checkedOutCount} checked out · ${notCheckedInCount} not in yet`, onClick: () => { setAttendanceTab('online'); setOnlineDialogOpen(true); } },
    { title: 'Total Resources', value: totalResources, icon: ComputerIcon, color: '#64748B', bgColor: '#F1F5F9', subtitle: `${availableRes} available`, path: '/resources' },
    { title: 'Active Projects', value: activeProjects, icon: FolderIcon, color: '#D97706', bgColor: '#FFFBEB', subtitle: `${completedProjects} completed`, trend: newProjectsThisMonth > 0 ? `+${newProjectsThisMonth} this month` : undefined, path: '/projects' },
    { title: 'Active Assignments', value: activeAssignments, icon: AssignmentIcon, color: '#16A34A', bgColor: '#F0FDF4', subtitle: 'Currently allocated', path: '/assignments' },
  ];

  if (empError) {
    return <Alert severity="error">Error loading dashboard data. Please refresh the page.</Alert>;
  }

  return (
    <Box>
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontFamily: SERIF, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Welcome back, {userFirstName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Company-wide overview across HR, resources, and projects
          </Typography>
        </Box>
      </motion.div>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        gap: 2, mb: 3,
      }}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat, i) => <StatCard key={stat.title} index={i + 1} {...stat} />)}
      </Box>

      {/* Employees with a fixed shift who haven't clocked in yet - shift is
          optional per employee, only shown when there's actually someone to flag. */}
      {!isLoading && missedShiftEmployees.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {missedShiftEmployees.length} employee{missedShiftEmployees.length > 1 ? 's' : ''} with a shift haven't clocked in yet
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {missedShiftEmployees.map((e: any) => (
              <Chip key={e.id} size="small" label={`${e.name} (due ${e.fixed_clock_in_time})`} />
            ))}
          </Box>
        </Alert>
      )}

      {/* People still clocked in past the long-shift threshold - a soft
          heads-up, not an alarm: this office has no fixed clock-out time and
          shifts can legitimately run 24h+, so this is just visibility for a
          manager to check in on, not something to act on automatically. */}
      {!longShiftsLoading && longShiftEmployees.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {longShiftEmployees.length} employee{longShiftEmployees.length > 1 ? 's' : ''} clocked in for a long stretch
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {longShiftEmployees.map((e: any) => (
              <Chip key={e.id} size="small" label={`${e.name} · ${e.hours_elapsed}h`} />
            ))}
          </Box>
        </Alert>
      )}

      {/* Activity trend */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, mb: 2 }}>
        <ActivityTrend index={8} />
      </Box>

      {/* Charts row 1 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2, mb: 2 }}>
        <ChartPanel title="Employee Status" subtitle="Active vs. inactive" index={9} minHeight={180}>
          {isLoading ? <Skeleton variant="circular" width={140} height={140} sx={{ mx: 'auto' }} /> : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
              <ResponsiveContainer width="55%" height={160}>
                <PieChart>
                  <Pie data={empStatusData} cx="50%" cy="50%" innerRadius={44} outerRadius={66}
                    dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                    {empStatusData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <ReTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: '#16A34A' }}>
                  {totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0}%
                </Typography>
                <Typography variant="caption" color="text.secondary">Active rate</Typography>
                <Divider sx={{ my: 1.5 }} />
                {empStatusData.map(d => (
                  <LegendRow key={d.name} color={d.color} label={d.name} value={d.value} max={Math.max(...empStatusData.map(x => x.value), 1)} />
                ))}
              </Box>
            </Box>
          )}
        </ChartPanel>

        <ChartPanel title="Employees by Department" subtitle="Headcount distribution" index={10} minHeight={180}>
          {isLoading ? <Skeleton height={160} /> : deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={76} />
                <ReTooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="count" name="Employees" fill="#4F46E5" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Typography variant="body2" color="text.secondary">No department data yet</Typography>
            </Box>
          )}
        </ChartPanel>
      </Box>

      {/* Charts row 2 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <ChartPanel title="Resource Utilisation" subtitle="Current asset allocation" index={11} minHeight={180}>
          {isLoading ? <Skeleton variant="circular" width={140} height={140} sx={{ mx: 'auto' }} /> : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
              <ResponsiveContainer width="55%" height={160}>
                <PieChart>
                  <Pie data={resStatusData} cx="50%" cy="50%" innerRadius={44} outerRadius={66}
                    dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                    {resStatusData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <ReTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: '#4F46E5' }}>
                  {totalResources > 0 ? Math.round((assignedRes / totalResources) * 100) : 0}%
                </Typography>
                <Typography variant="caption" color="text.secondary">Utilisation rate</Typography>
                <Divider sx={{ my: 1.5 }} />
                {resStatusData.map(d => (
                  <LegendRow key={d.name} color={d.color} label={d.name} value={d.value} max={Math.max(...resStatusData.map(x => x.value), 1)} />
                ))}
              </Box>
            </Box>
          )}
        </ChartPanel>

        <ChartPanel title="Project Pipeline" subtitle={`${totalProjects} total projects`} index={12} minHeight={180}>
          {isLoading ? <Skeleton height={160} /> : projStatusData.length > 0 ? (
            <Box>
              <Box sx={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', mb: 2 }}>
                {projStatusData.map((d, i) => (
                  <Box key={i} sx={{ width: `${totalProjects > 0 ? (d.count / totalProjects) * 100 : 0}%`, bgcolor: d.fill }} />
                ))}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                {projStatusData.map(d => {
                  const pct = totalProjects > 0 ? Math.round((d.count / totalProjects) * 100) : 0;
                  return (
                    <Box key={d.name} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Chip label={d.name} size="small" sx={{ bgcolor: alpha(d.fill, 0.12), color: d.fill, fontWeight: 600, height: 20, fontSize: '0.6875rem' }} />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{d.count}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{pct}%</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Box sx={{ textAlign: 'center' }}>
                <FolderIcon sx={{ fontSize: 36, color: '#E2E8F0', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No projects yet</Typography>
              </Box>
            </Box>
          )}
        </ChartPanel>
      </Box>

      {/* Pending requests lists */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <ChartPanel title="Pending Leave Requests" subtitle={`${pendingLeaves.length} awaiting review`} index={13} minHeight={200}>
          {isLoading ? <Skeleton height={180} /> : pendingLeaves.length > 0 ? (
            <List dense disablePadding>
              {pendingLeaves.slice(0, 6).map((l: any) => (
                <ListItem key={l.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><LeaveIcon sx={{ fontSize: 18, color: '#D97706' }} /></ListItemIcon>
                  <ListItemText
                    primary={`${l.employee?.first_name ?? ''} ${l.employee?.last_name ?? ''}`}
                    secondary={`${l.leave_type?.name ?? l.leave_type ?? 'Leave'} · ${l.start_date} → ${l.end_date}`}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160,
              border: '2px dashed', borderColor: 'divider', borderRadius: 2,
            }}>
              <Typography variant="body2" color="text.secondary">All clear — no leave requests waiting on you.</Typography>
            </Box>
          )}
        </ChartPanel>

        <ChartPanel title="Pending Resource Requests" subtitle={`${pendingResourceRequests.length} awaiting review`} index={14} minHeight={200}>
          {isLoading ? <Skeleton height={180} /> : pendingResourceRequests.length > 0 ? (
            <List dense disablePadding>
              {pendingResourceRequests.slice(0, 6).map((r: any) => (
                <ListItem key={r.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><ResourceRequestIcon sx={{ fontSize: 18, color: '#DC2626' }} /></ListItemIcon>
                  <ListItemText
                    primary={`${r.employee?.first_name ?? ''} ${r.employee?.last_name ?? ''}`}
                    secondary={r.resource?.name ?? 'Resource'}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160,
              border: '2px dashed', borderColor: 'divider', borderRadius: 2,
            }}>
              <Typography variant="body2" color="text.secondary">All clear — no resource requests waiting on you.</Typography>
            </Box>
          )}
        </ChartPanel>
      </Box>

      {/* Recent activity */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, mt: 2 }}>
        <RecentActivity index={15} />
      </Box>

      {/* Today's attendance breakdown: online / checked out / not checked in yet */}
      <Dialog open={onlineDialogOpen} onClose={() => setOnlineDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0 }}>Today's Attendance</DialogTitle>
        <Tabs
          value={attendanceTab}
          onChange={(_, v) => setAttendanceTab(v)}
          variant="fullWidth"
          sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Tab value="online" label={`Online (${checkedInEmployees.length})`} sx={{ fontSize: '0.75rem', minHeight: 40 }} />
          <Tab value="checked_out" label={`Checked Out (${checkedOutEmployees.length})`} sx={{ fontSize: '0.75rem', minHeight: 40 }} />
          <Tab value="not_checked_in" label={`Not In (${notCheckedInEmployees.length})`} sx={{ fontSize: '0.75rem', minHeight: 40 }} />
        </Tabs>
        <DialogContent dividers sx={{ p: 0 }}>
          {(() => {
            const rows =
              attendanceTab === 'online' ? checkedInEmployees :
              attendanceTab === 'checked_out' ? checkedOutEmployees :
              notCheckedInEmployees;
            const emptyMessage =
              attendanceTab === 'online' ? 'No one is clocked in right now.' :
              attendanceTab === 'checked_out' ? 'No one has checked out yet today.' :
              'Everyone has checked in today.';
            const dotColor =
              attendanceTab === 'online' ? '#16A34A' :
              attendanceTab === 'checked_out' ? '#64748B' :
              '#DC2626';

            if (rows.length === 0) {
              return <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{emptyMessage}</Typography>;
            }
            return (
              <List dense disablePadding>
                {rows.map((e: any) => {
                  const timing =
                    attendanceTab === 'checked_out' && e.clock_out
                      ? `left ${new Date(e.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : attendanceTab !== 'not_checked_in' && e.clock_in
                        ? `since ${new Date(e.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : e.fixed_clock_in_time
                          ? `shift starts ${e.fixed_clock_in_time}`
                          : null;
                  return (
                    <ListItem key={e.id} sx={{ py: 1 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}><CircleIcon sx={{ fontSize: 10, color: dotColor }} /></ListItemIcon>
                      <ListItemText
                        primary={e.name}
                        secondary={`${e.position || ''}${e.department ? ` · ${e.department}` : ''} · ${e.attendance_type}${timing ? ` · ${timing}` : ''}`}
                        slotProps={{
                          primary: { fontSize: '0.875rem', fontWeight: 600 },
                          secondary: { fontSize: '0.75rem' },
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

// ─── Permission-aware approvals widgets ───────────────────────────────────────
// Shown on the self-service dashboard for anyone holding an approval/management
// permission but not the legacy admin/manager role string - Team Leads, Project
// Managers, Accountants, HR Managers, etc. Which widgets appear is driven purely
// by hasPermission() rather than a department field, since a person's granted
// permissions are a more reliable signal of what they actually need to act on
// than a free-text department string.
const ApprovalsWidgets: React.FC<{ startIndex: number }> = ({ startIndex }) => {
  const { hasPermission } = useAuth();

  const canApproveLeave = hasPermission('leave.approve');
  const canManageResources = hasPermission('resources.manage');
  const canManageProjects = hasPermission('projects.manage') || hasPermission('assignments.manage');

  const anyWidget = canApproveLeave || canManageResources || canManageProjects;

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['leaves', 'pending'], queryFn: leaveService.getPending, retry: 1, enabled: canApproveLeave,
  });
  const { data: pendingResourceRequests = [] } = useQuery({
    queryKey: ['resource-requests', 'pending'], queryFn: () => resourceService.getRequests('pending'), retry: 1, enabled: canManageResources,
  });
  const { data: managedProjects = [] } = useQuery({
    queryKey: ['projects'], queryFn: projectService.getAll, retry: 1, enabled: canManageProjects,
  });

  if (!anyWidget) return null;

  const activeManagedProjects = (managedProjects as any[]).filter((p) => p.status === 'active');

  const stats = [
    canApproveLeave && { title: 'Pending Leave Approvals', value: pendingLeaves.length, icon: LeaveIcon, color: '#D97706', bgColor: '#FFFBEB', subtitle: 'Awaiting your decision', path: '/leaves' },
    canManageResources && { title: 'Pending Resource Requests', value: pendingResourceRequests.length, icon: ResourceRequestIcon, color: '#DC2626', bgColor: '#FEF2F2', subtitle: 'Awaiting your decision', path: '/resources?tab=requests' },
    canManageProjects && { title: 'Active Projects', value: activeManagedProjects.length, icon: FolderIcon, color: '#334155', bgColor: '#F1F5F9', subtitle: 'You manage', path: '/projects' },
  ].filter(Boolean) as any[];

  return (
    <Box sx={{ mt: 1 }}>
      <Divider sx={{ mb: 3 }} />
      <Typography variant="h6" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, mb: 0.5 }}>Your Approvals & Team</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Based on your designation's permissions
      </Typography>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: `repeat(${Math.min(stats.length, 4)}, 1fr)` },
        gap: 2,
      }}>
        {stats.map((stat, i) => <StatCard key={stat.title} index={startIndex + i} {...stat} />)}
      </Box>
    </Box>
  );
};

// ─── Employee (self-service) dashboard ────────────────────────────────────────
const statusMeta: Record<string, { color: string; icon: any }> = {
  present:  { color: '#16A34A', icon: CheckCircleIcon },
  late:     { color: '#D97706', icon: ScheduleIcon },
  'half-day': { color: '#D97706', icon: ScheduleIcon },
  not_clocked: { color: '#94A3B8', icon: CircleIcon },
  leave:    { color: '#334155', icon: LeaveIcon },
  holiday:  { color: '#334155', icon: CircleIcon },
};

const EmployeeDashboard: React.FC<{ userFirstName?: string }> = ({ userFirstName }) => {
  const queryClient = useQueryClient();
  const { isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['profile', 'me'], queryFn: employeeService.getMyProfile, retry: 1,
  });

  const { data: myLeaves = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', 'my'], queryFn: leaveService.getMyLeaves, retry: 1,
  });

  const { data: leaveBalance = [], isLoading: balanceLoading } = useQuery({
    queryKey: ['leaves', 'balance'], queryFn: leaveService.getBalance, retry: 1,
  });

  const { data: attendanceStats, isLoading: attLoading } = useQuery({
    queryKey: ['attendance', 'stats'], queryFn: attendanceService.getStats, retry: 1,
  });

  const { data: myAssignments = [], isLoading: assignLoading } = useQuery({
    queryKey: ['assignments'], queryFn: assignmentService.getAll, retry: 1,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      // Best-effort location capture - clock-in should still work if the
      // browser has no geolocation, the user denies the permission prompt,
      // or it times out, just without a location attached (same fallback
      // the dedicated Attendance page uses). Previously this button never
      // even tried, so every dashboard clock-in landed with no location.
      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
      return position
        ? attendanceService.clockIn(position.coords.latitude, position.coords.longitude)
        : attendanceService.clockIn();
    },
    onSuccess: () => {
      toast.success('Clocked in');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to clock in')),
  });

  const isLoading = profileLoading || leavesLoading || balanceLoading || attLoading || assignLoading;

  const pendingLeaveCount = myLeaves.filter((l: any) => l.status === 'pending').length;
  const approvedLeaveCount = myLeaves.filter((l: any) => l.status === 'approved').length;
  const activeAssignments = myAssignments.filter((a: any) => a.status === 'active');
  const totalBalance = leaveBalance.reduce((sum: number, b: any) => sum + (b.remaining_days ?? b.total_days ?? 0), 0);

  const todayStatus: string = attendanceStats?.today?.status ?? 'not_clocked';
  const StatusIcon = statusMeta[todayStatus]?.icon ?? CircleIcon;
  const statusColor = statusMeta[todayStatus]?.color ?? '#94A3B8';

  const stats = [
    { title: "Today's Status", value: todayStatus.replace('_', ' '), icon: AttendanceIcon, color: statusColor, bgColor: '#F1F5F9', subtitle: attendanceStats?.today?.clocked_in ? 'Clocked in' : 'Not clocked in yet', path: '/attendance' },
    { title: 'Leave Balance', value: totalBalance, icon: LeaveIcon, color: '#334155', bgColor: '#F1F5F9', subtitle: `${pendingLeaveCount} pending request(s)`, path: '/leaves' },
    { title: 'My Resources', value: activeAssignments.length, icon: ComputerIcon, color: '#64748B', bgColor: '#F1F5F9', subtitle: 'Currently assigned to you', path: '/assignments' },
    { title: 'Approved Leaves', value: approvedLeaveCount, icon: CheckCircleIcon, color: '#16A34A', bgColor: '#F0FDF4', subtitle: 'This year', path: '/leaves' },
  ];

  // Any authenticated user (even one with no linked Employee record and no
  // real role/permissions) used to reach this page and hit broken/erroring
  // widgets, since the /dashboard route has no router-level guard and this
  // component fired all its queries unconditionally. A missing employee
  // profile means the account isn't actually set up yet - show a clear
  // message instead of letting the rest of this component error out.
  if (!profileLoading && profileError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Your account isn't fully set up</Typography>
          <Typography variant="body2" color="text.secondary">
            There's no employee record linked to your login yet. Contact an admin to finish setting up your account.
          </Typography>
        </Box>
      </Box>
    );
  }

  // Regular employees must clock in before seeing the rest of their
  // dashboard (admins/managers are exempt - they get AdminDashboard instead).
  if (!isLoading && !attendanceStats?.today?.clocked_in) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
          <AttendanceIcon sx={{ fontSize: 40, color: '#94A3B8', mb: 1.5 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Welcome back, {userFirstName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Clock in to see your dashboard for today.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Your browser will ask to share your location - allow it so your clock-in records where you're working from.
          </Typography>
          <Button
            variant="contained"
            color="success"
            onClick={() => clockInMutation.mutate()}
            disabled={clockInMutation.isPending}
          >
            {clockInMutation.isPending ? 'Clocking in…' : 'Clock In'}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontFamily: SERIF, fontWeight: 700, letterSpacing: '-0.01em' }}>
            Welcome back, {userFirstName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Here's a snapshot of your attendance, leave, and assigned resources
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <ChartPanel title="My Recent Leave Requests" subtitle={`${myLeaves.length} total`} index={5} minHeight={200}>
          {isLoading ? <Skeleton height={180} /> : myLeaves.length > 0 ? (
            <List dense disablePadding>
              {myLeaves.slice(0, 6).map((l: any) => (
                <ListItem key={l.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {l.status === 'approved'
                      ? <CheckCircleIcon sx={{ fontSize: 18, color: '#16A34A' }} />
                      : l.status === 'rejected'
                        ? <CancelIcon sx={{ fontSize: 18, color: '#DC2626' }} />
                        : <ScheduleIcon sx={{ fontSize: 18, color: '#D97706' }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={`${l.leave_type?.name ?? l.leave_type ?? 'Leave'} · ${l.start_date} → ${l.end_date}`}
                    secondary={l.reason}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  <Chip
                    label={l.status}
                    size="small"
                    color={l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'error' : 'warning'}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Typography variant="body2" color="text.secondary">No leave requests yet</Typography>
            </Box>
          )}
        </ChartPanel>

        <ChartPanel title="My Assigned Resources" subtitle={`${activeAssignments.length} active`} index={6} minHeight={200}>
          {isLoading ? <Skeleton height={180} /> : activeAssignments.length > 0 ? (
            <List dense disablePadding>
              {activeAssignments.slice(0, 6).map((a: any) => (
                <ListItem key={a.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><ComputerIcon sx={{ fontSize: 18, color: '#64748B' }} /></ListItemIcon>
                  <ListItemText
                    primary={a.resource?.name}
                    secondary={(a.projects && a.projects.length > 0 ? a.projects.map((p: any) => p.name).join(', ') : a.project?.name) ?? 'No project'}
                    primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Box sx={{ textAlign: 'center' }}>
                <ComputerIcon sx={{ fontSize: 36, color: '#E2E8F0', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No resources assigned to you</Typography>
              </Box>
            </Box>
          )}
        </ChartPanel>
      </Box>

      <ApprovalsWidgets startIndex={7} />
    </Box>
  );
};

// ─── Dashboard entry point ─────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { isManager, user } = useAuth();
  return isManager
    ? <AdminDashboard userFirstName={user?.first_name} />
    : <EmployeeDashboard userFirstName={user?.first_name} />;
};

export default Dashboard;
