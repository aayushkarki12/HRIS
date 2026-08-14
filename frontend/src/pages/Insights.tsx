import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, TextField, Alert, Skeleton,
} from '@mui/material';
import { WarningAmberRounded as WarningIcon, GroupsOutlined as GroupsIcon, CheckCircleOutlined as CheckIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
} from 'recharts';
import { attendanceService, getErrorMessage } from '../services/api';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.22, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

// Same validated order/colors as the mobile app's Insights screen (see
// HRIS_app/lib/insights_screen.dart::_compositionOrder) - green/amber/red
// never sit adjacent to each other, keeping every touching pair at or above
// the colorblind-safe separation floor. Reordering would reintroduce a
// red/amber pair that fails that check.
const COMPOSITION_ORDER: { key: 'present' | 'late' | 'leave' | 'absent'; label: string; color: string }[] = [
  { key: 'present', label: 'Present', color: '#16A34A' },
  { key: 'late', label: 'Late', color: '#D97706' },
  { key: 'leave', label: 'Leave', color: '#4F46E5' },
  { key: 'absent', label: 'Absent', color: '#DC2626' },
];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', px: 1.5, py: 1, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      {label && <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, mb: 0.25, color: '#475569' }}>{label}</Typography>}
      {payload.map((p: any) => (
        <Typography key={p.name} variant="caption" sx={{ display: 'block', color: p.color || '#0F172A', fontWeight: 500 }}>
          {p.name}: <strong>{p.value}</strong>
        </Typography>
      ))}
    </Box>
  );
};

const Card: React.FC<{ children: React.ReactNode; index: number }> = ({ children, index }) => (
  <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
    <Box sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
      {children}
    </Box>
  </motion.div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{children}</Typography>
);

const defaultRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
};

const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/// Admin/manager HR-analytics view: who worked how many hours, the team's
/// attendance mix, and where everyone worked from, over a date range.
/// Same data/design language as the mobile app's Insights screen (see
/// HRIS_app/lib/insights_screen.dart), backed by the same endpoints.
const Insights: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState(defaultRange());
  const [search, setSearch] = useState('');

  const { data: report = [], isLoading, error } = useQuery({
    queryKey: ['insights', 'hours-report', range.start, range.end],
    queryFn: () => attendanceService.getHoursReport(range.start, range.end),
  });

  const { data: longShifts } = useQuery({
    queryKey: ['insights', 'long-shifts'],
    queryFn: attendanceService.getLongShifts,
  });

  const entries = report as any[];
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((e) =>
      [e.employee_name, e.department, e.position].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [entries, search]);

  const sum = (key: string) => entries.reduce((s, e) => s + (e[key] ?? 0), 0);
  const totalHours = sum('total_hours');
  const totalPresent = sum('days_present');
  const totalLate = sum('days_late');
  const totalAbsent = sum('days_absent');
  const totalLeave = sum('days_leave');
  const totalRecorded = sum('days_recorded');
  const avgRate = totalRecorded > 0 ? (totalPresent + totalLate) / totalRecorded : 0;
  const longShiftCount = longShifts?.count ?? 0;
  const compositionValues: Record<string, number> = { present: totalPresent, late: totalLate, leave: totalLeave, absent: totalAbsent };
  const compositionTotal = totalPresent + totalLate + totalLeave + totalAbsent;

  const locationTotals = new Map<string, number>();
  entries.forEach((e) => {
    (e.top_locations ?? []).forEach((loc: any) => {
      const name = loc.location_name ?? 'Unknown';
      locationTotals.set(name, (locationTotals.get(name) ?? 0) + (loc.hours ?? 0));
    });
  });
  const topLocations = Array.from(locationTotals.entries())
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);

  const hoursChartData = [...visible]
    .sort((a, b) => (b.total_hours ?? 0) - (a.total_hours ?? 0))
    .map((e) => ({ name: e.employee_name, hours: Math.round((e.total_hours ?? 0) * 10) / 10, employee_id: e.employee_id }));

  const hoursChartHeight = Math.max(120, hoursChartData.length * 34 + 20);
  const locationsChartHeight = Math.max(120, topLocations.length * 34 + 20);

  return (
    <Box>
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>Insights</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Who worked how many hours, the team's attendance mix, and where everyone worked from
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              size="small" label="Start Date" type="date" value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small" label="End Date" type="date" value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </Box>
      </motion.div>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{getErrorMessage(error, 'Failed to load insights')}</Alert>
      )}

      {isLoading ? (
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      ) : entries.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography color="text.secondary">No attendance data for this range.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Card index={1}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {fmtShortDate(range.start)} – {fmtShortDate(range.end)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
              <Typography sx={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {totalHours.toFixed(1)}
              </Typography>
              <Typography color="text.secondary">hours worked</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <GroupsIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="body2"><strong>{entries.length}</strong> employees</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CheckIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="body2"><strong>{Math.round(avgRate * 100)}%</strong> avg attendance</Typography>
              </Box>
            </Box>
          </Card>

          {longShiftCount > 0 && (
            <Alert severity="warning" icon={<WarningIcon fontSize="inherit" />} sx={{ borderRadius: 2 }}>
              {longShiftCount} employee{longShiftCount === 1 ? '' : 's'} currently on a long-running shift
            </Alert>
          )}

          <Box>
            <SectionTitle>Attendance mix</SectionTitle>
            <Card index={2}>
              {compositionTotal === 0 ? (
                <Typography variant="body2" color="text.secondary">No attendance days recorded yet.</Typography>
              ) : (
                <>
                  <Box sx={{ display: 'flex', gap: '2px', height: 14, borderRadius: '4px', overflow: 'hidden' }}>
                    {COMPOSITION_ORDER.filter((c) => compositionValues[c.key] > 0).map((c) => (
                      <Box
                        key={c.key}
                        sx={{ bgcolor: c.color, flex: compositionValues[c.key], height: '100%' }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mt: 2 }}>
                    {COMPOSITION_ORDER.map((c) => (
                      <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color }} />
                        <Typography variant="caption" color="text.secondary">
                          {c.label} ({compositionValues[c.key]})
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}
            </Card>
          </Box>

          <Box>
            <SectionTitle>Hours by employee</SectionTitle>
            <TextField
              size="small" fullWidth placeholder="Search name, department, position"
              value={search} onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 1.5 }}
            />
            <Card index={3}>
              {hoursChartData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No employees match.</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={hoursChartHeight}>
                  <BarChart data={hoursChartData} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={110} />
                    <ReTooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                    <Bar
                      dataKey="hours" name="Hours" fill="#4F46E5" radius={[0, 4, 4, 0]} maxBarSize={18}
                      onClick={(data: any) => navigate(`/employees/${data.employee_id}`)}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Box>

          {topLocations.length > 0 && (
            <Box>
              <SectionTitle>Top work locations</SectionTitle>
              <Card index={4}>
                <ResponsiveContainer width="100%" height={locationsChartHeight}>
                  <BarChart data={topLocations} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={110} />
                    <ReTooltip content={<ChartTooltip />} cursor={{ fill: '#F8FAFC' }} />
                    <Bar dataKey="hours" name="Hours" fill="#0891B2" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default Insights;
