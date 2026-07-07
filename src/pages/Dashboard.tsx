import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Card, CardContent, Typography, Divider, Skeleton,
  Alert, LinearProgress, Chip, List, ListItem, ListItemText, ListItemIcon,
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
} from 'recharts';
import {
  employeeService, resourceService, projectService, assignmentService,
  leaveService, attendanceService, auditLogService,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.22, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

// ─── Shared building blocks ───────────────────────────────────────────────────
const StatCardSkeleton: React.FC = () => (
  <Card sx={{ borderRadius: 2 }}>
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

const StatCard: React.FC<{ title: string; value: number | string; subtitle?: string; trend?: string; icon: any; color: string; bgColor: string; index: number; path?: string }> =
  ({ title, value, subtitle, trend, icon: Icon, color, bgColor, index, path }) => {
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
  create: '#4F46E5', process: '#4F46E5', post: '#4F46E5',
  pay: '#16A34A', record_payment: '#16A34A', send: '#0891B2', check_in: '#0891B2',
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

// ─── Admin / manager dashboard ────────────────────────────────────────────────
const AdminDashboard: React.FC<{ userFirstName?: string }> = ({ userFirstName }) => {
  const { data: employees = [], isLoading: empLoading, error: empError } =
    useQuery({ queryKey: ['employees'], queryFn: employeeService.getAll, retry: 1 });

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

  const isLoading = empLoading || resLoading || projLoading || assignLoading || leaveLoading || reqLoading || attLoading;

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

  const checkedIn = attendanceOverview?.checked_in ?? 0;
  const totalActive = attendanceOverview?.total_active_employees ?? 0;

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
    { title: 'Total Employees', value: totalEmployees, icon: PeopleIcon, color: '#4F46E5', bgColor: '#EEF2FF', subtitle: `${activeEmployees} active`, trend: newEmployeesThisMonth > 0 ? `+${newEmployeesThisMonth} this month` : undefined, path: '/employees' },
    { title: 'Pending Leave Requests', value: pendingLeaves.length, icon: LeaveIcon, color: '#D97706', bgColor: '#FFFBEB', subtitle: 'Awaiting your decision', path: '/leaves' },
    { title: 'Pending Resource Requests', value: pendingResourceRequests.length, icon: ResourceRequestIcon, color: '#DC2626', bgColor: '#FEF2F2', subtitle: 'Awaiting your decision', path: '/resources' },
    { title: "Today's Attendance", value: `${checkedIn}/${totalActive}`, icon: AttendanceIcon, color: '#0891B2', bgColor: '#ECFEFF', subtitle: `${attendanceOverview?.absent ?? 0} not checked in`, path: '/attendance' },
    { title: 'Total Resources', value: totalResources, icon: ComputerIcon, color: '#0891B2', bgColor: '#ECFEFF', subtitle: `${availableRes} available`, path: '/resources' },
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
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
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
                  <Box key={d.name} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                      <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{d.value}</Typography>
                  </Box>
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
                  <Box key={d.name} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                      <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>{d.value}</Typography>
                  </Box>
                ))}
                {totalResources > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <LinearProgress
                      variant="determinate"
                      value={Math.round((assignedRes / totalResources) * 100)}
                      sx={{ height: 4, borderRadius: 2, bgcolor: '#EEF2FF', '& .MuiLinearProgress-bar': { bgcolor: '#4F46E5' } }}
                    />
                  </>
                )}
              </Box>
            </Box>
          )}
        </ChartPanel>

        <ChartPanel title="Project Pipeline" subtitle={`${totalProjects} total projects`} index={12} minHeight={180}>
          {isLoading ? <Skeleton height={160} /> : projStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={projStatusData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <ReTooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="count" name="Projects" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {projStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 36, color: '#BBF7D0', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">Nothing pending</Typography>
              </Box>
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 36, color: '#BBF7D0', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">Nothing pending</Typography>
              </Box>
            </Box>
          )}
        </ChartPanel>
      </Box>

      {/* Recent activity */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, mt: 2 }}>
        <RecentActivity index={15} />
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
  leave:    { color: '#4F46E5', icon: LeaveIcon },
  holiday:  { color: '#4F46E5', icon: CircleIcon },
};

const EmployeeDashboard: React.FC<{ userFirstName?: string }> = ({ userFirstName }) => {
  const { data: profile, isLoading: profileLoading } = useQuery({
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

  const isLoading = profileLoading || leavesLoading || balanceLoading || attLoading || assignLoading;

  const pendingLeaveCount = myLeaves.filter((l: any) => l.status === 'pending').length;
  const approvedLeaveCount = myLeaves.filter((l: any) => l.status === 'approved').length;
  const activeAssignments = myAssignments.filter((a: any) => a.status === 'active');
  const totalBalance = leaveBalance.reduce((sum: number, b: any) => sum + (b.remaining_days ?? b.total_days ?? 0), 0);

  const todayStatus: string = attendanceStats?.today?.status ?? 'not_clocked';
  const StatusIcon = statusMeta[todayStatus]?.icon ?? CircleIcon;
  const statusColor = statusMeta[todayStatus]?.color ?? '#94A3B8';

  const stats = [
    { title: "Today's Status", value: todayStatus.replace('_', ' '), icon: AttendanceIcon, color: statusColor, bgColor: '#ECFEFF', subtitle: attendanceStats?.today?.clocked_in ? 'Clocked in' : 'Not clocked in yet', path: '/attendance' },
    { title: 'Leave Balance', value: totalBalance, icon: LeaveIcon, color: '#4F46E5', bgColor: '#EEF2FF', subtitle: `${pendingLeaveCount} pending request(s)`, path: '/leaves' },
    { title: 'My Resources', value: activeAssignments.length, icon: ComputerIcon, color: '#0891B2', bgColor: '#ECFEFF', subtitle: 'Currently assigned to you', path: '/assignments' },
    { title: 'Approved Leaves', value: approvedLeaveCount, icon: CheckCircleIcon, color: '#16A34A', bgColor: '#F0FDF4', subtitle: 'This year', path: '/leaves' },
  ];

  return (
    <Box>
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
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
                  <ListItemIcon sx={{ minWidth: 32 }}><ComputerIcon sx={{ fontSize: 18, color: '#0891B2' }} /></ListItemIcon>
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
