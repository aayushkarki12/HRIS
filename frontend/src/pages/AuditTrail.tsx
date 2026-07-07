import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, Chip, Avatar,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon, History as HistoryIcon,
  Login as LoginIcon, Logout as LogoutIcon, Lock as LockIcon, Security as SecurityIcon,
  CheckCircle as ApproveIcon, Cancel as RejectIcon, Add as CreateIcon, Edit as UpdateIcon,
  Delete as DeleteIcon, Publish as PostIcon,
} from '@mui/icons-material';
import { auditLogService, userService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const SEVERITY_META: Record<string, { color: string; bg: string }> = {
  info: { color: '#2563EB', bg: '#EFF6FF' },
  warning: { color: '#D97706', bg: '#FFFBEB' },
  critical: { color: '#DC2626', bg: '#FEF2F2' },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  login: LoginIcon, login_failed: LoginIcon, logout: LogoutIcon,
  password_change: LockIcon, password_reset: LockIcon, role_change: SecurityIcon,
  approve: ApproveIcon, manager_approve: ApproveIcon, accounting_approve: ApproveIcon,
  reject: RejectIcon, cancel: RejectIcon, create: CreateIcon, update: UpdateIcon,
  delete: DeleteIcon, deactivate: DeleteIcon, post: PostIcon, submit: PostIcon,
};

const MODULE_COLORS: Record<string, string> = {
  Accounting: '#4F46E5', Expenses: '#D97706', HR: '#16A34A', Payroll: '#0891B2',
  Resources: '#7C3AED', Security: '#DC2626', Other: '#64748B',
};

const fmtDateTime = (d: string) => new Date(d).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});

const userLabel = (u: any) => u ? (`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username) : 'System';

const emptyFilters = { user_id: '', module: '', action: '', start_date: '', end_date: '' };

const AuditTrail: React.FC = () => {
  const { isManager } = useAuth();
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const activeParams: any = {
    skip: page * pageSize,
    limit: pageSize,
  };
  if (filters.user_id) activeParams.user_id = Number(filters.user_id);
  if (filters.module) activeParams.module = filters.module;
  if (filters.action) activeParams.action = filters.action;
  if (filters.start_date) activeParams.start_date = filters.start_date;
  if (filters.end_date) activeParams.end_date = filters.end_date;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-trail', activeParams],
    queryFn: () => auditLogService.getAll(activeParams),
    enabled: isManager,
  });

  const { data: meta } = useQuery({
    queryKey: ['audit-trail-meta'],
    queryFn: () => auditLogService.getMeta(),
    enabled: isManager,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-audit-filter'],
    queryFn: () => userService.getAll(),
    enabled: isManager,
  });

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleExport = async () => {
    const blob = await auditLogService.exportCsv(activeParams);
    const url = window.URL.createObjectURL(new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  if (!isManager) return <AccessDenied />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Audit Trail</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Immutable record of every tracked action across the system
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
          Export CSV
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 1.5 }}>
          <TextField
            select size="small" label="User" value={filters.user_id}
            onChange={(e) => handleFilterChange('user_id', e.target.value)}
          >
            <MenuItem value="">All Users</MenuItem>
            {users.map((u: any) => (
              <MenuItem key={u.id} value={u.id}>{userLabel(u)}</MenuItem>
            ))}
          </TextField>
          <TextField
            select size="small" label="Module" value={filters.module}
            onChange={(e) => handleFilterChange('module', e.target.value)}
          >
            <MenuItem value="">All Modules</MenuItem>
            {(meta?.modules ?? []).map((m: string) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
          <TextField
            select size="small" label="Action" value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
          >
            <MenuItem value="">All Actions</MenuItem>
            {(meta?.actions ?? []).map((a: string) => (
              <MenuItem key={a} value={a} sx={{ textTransform: 'capitalize' }}>{a.replace(/_/g, ' ')}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small" label="From" type="date" value={filters.start_date}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            size="small" label="To" type="date" value={filters.end_date}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
        {(filters.user_id || filters.module || filters.action || filters.start_date || filters.end_date) && (
          <Button size="small" sx={{ mt: 1 }} onClick={() => { setFilters(emptyFilters); setPage(0); }}>
            Clear filters
          </Button>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : logs.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <HistoryIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No activity matches these filters</Typography>
          </Box>
        ) : (
          <Box>
            {logs.map((log: any, i: number) => {
              const ActionIcon = ACTION_ICONS[log.action] ?? HistoryIcon;
              const sevMeta = SEVERITY_META[log.severity] ?? SEVERITY_META.info;
              const moduleColor = MODULE_COLORS[log.module] ?? MODULE_COLORS.Other;
              return (
                <Box
                  key={log.id}
                  sx={{
                    display: 'flex', gap: 2, px: 2.5, py: 1.75,
                    borderBottom: i < logs.length - 1 ? '1px solid' : 'none', borderColor: 'divider',
                    '&:hover': { bgcolor: '#F8FAFC' },
                  }}
                >
                  <Avatar sx={{ width: 36, height: 36, bgcolor: `${sevMeta.color}1A`, color: sevMeta.color }}>
                    <ActionIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{userLabel(log.user)}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                        {log.action.replace(/_/g, ' ')}
                      </Typography>
                      <Chip label={log.entity_type.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ textTransform: 'capitalize', height: 20, fontSize: 11 }} />
                      {log.entity_id && <Typography variant="caption" color="text.secondary">#{log.entity_id}</Typography>}
                      <Chip label={log.module} size="small" sx={{ bgcolor: `${moduleColor}1A`, color: moduleColor, fontWeight: 700, height: 20, fontSize: 11 }} />
                      {log.severity !== 'info' && (
                        <Chip label={log.severity} size="small" sx={{ bgcolor: sevMeta.bg, color: sevMeta.color, fontWeight: 700, height: 20, fontSize: 11, textTransform: 'capitalize' }} />
                      )}
                    </Box>
                    {log.details && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{log.details}</Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                      <Typography variant="caption" color="text.disabled">{fmtDateTime(log.created_at)}</Typography>
                      {log.ip_address && <Typography variant="caption" color="text.disabled">{log.ip_address}</Typography>}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {logs.length === 0 ? 'No results' : `Showing ${page * pageSize + 1}–${page * pageSize + logs.length}`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
          <Button size="small" disabled={logs.length < pageSize} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </Box>
      </Box>
    </Box>
  );
};

export default AuditTrail;
