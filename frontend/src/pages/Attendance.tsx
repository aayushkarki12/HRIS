import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Skeleton, Alert, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  MyLocation as MyLocationIcon,
  LocationOn as LocationIcon,
  GpsFixed as TrackingIcon,
  MoreTime as MoreTimeIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { attendanceService, getErrorMessage } from '../services/api';
import EmptyState from '../components/common/EmptyState';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.05 } }),
};

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  present:     { label: 'Present',        color: 'success' },
  absent:      { label: 'Absent',         color: 'error' },
  late:        { label: 'Late',           color: 'warning' },
  'half-day':  { label: 'Half Day',       color: 'info' },
  holiday:     { label: 'Holiday',        color: 'secondary' },
  leave:       { label: 'Leave',          color: 'default' },
  left:        { label: 'Clocked Out',    color: 'default' },
  not_clocked: { label: 'Not Clocked In', color: 'default' },
};

const LOC_COLOR: Record<string, 'success' | 'primary' | 'warning' | 'default'> = {
  office: 'success', site: 'primary', wfh: 'warning',
};

const getStatus = (s: string) => STATUS_MAP[s] ?? { label: 'Unknown', color: 'default' };

// How often the browser tab reports a fresh location fix while clocked in.
// The backend treats a device offline after 35 minutes of silence (see
// OFFLINE_AFTER_MINUTES in attendance.py), so this stays comfortably under
// that while not hammering the GPS/network every few seconds.
const PING_INTERVAL_MS = 5 * 60_000;

const StatCard: React.FC<{ label: string; children: React.ReactNode; index: number }> = ({ label, children, index }) => (
  <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
    <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
      <CardContent sx={{ textAlign: 'center', py: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.secondary', fontSize: '0.675rem' }}>
          {label}
        </Typography>
        <Box sx={{ mt: 1 }}>{children}</Box>
      </CardContent>
    </Card>
  </motion.div>
);

const Attendance: React.FC = () => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [fixTarget, setFixTarget] = useState<any>(null);
  const [fixTime, setFixTime] = useState('');

  const { data: attendance = [], isLoading, refetch } = useQuery({
    queryKey: ['attendance', startDate, endDate],
    queryFn: () => attendanceService.getMyAttendance(startDate, endDate),
  });

  const { data: _stats, refetch: refetchStats } = useQuery({
    queryKey: ['attendanceStats'],
    queryFn: attendanceService.getStats,
  });

  const getLocation = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return; }
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        e => reject(new Error(e.message)),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });

  const handleGetLocation = async () => {
    setIsGettingLocation(true);
    try {
      const pos = await getLocation();
      setLocation(pos);
      setLocationStatus(`${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`);
      toast.success('Location captured');
    } catch (err: any) {
      toast.error(err.message || 'Failed to get location');
      setLocationStatus('');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const clockInMutation = useMutation({
    mutationFn: () => (location ? attendanceService.clockIn(location.lat, location.lng) : attendanceService.clockIn()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceStats'] });
      toast.success(`Clocked in — ${data.status}`);
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to clock in')),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => (location ? attendanceService.clockOut(location.lat, location.lng) : attendanceService.clockOut()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceStats'] });
      toast.success(`Clocked out — ${data.total_hours}h worked`);
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to clock out')),
  });

  const fixClockOutMutation = useMutation({
    mutationFn: () => attendanceService.fixClockOut(fixTarget.id, new Date(fixTime).toISOString()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceStats'] });
      toast.success(`Clocked out — ${data.total_hours}h worked`);
      setFixTarget(null);
      setFixTime('');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to clock out')),
  });

  const today = (attendance as any[]).find((a: any) => a.date === new Date().toISOString().split('T')[0]);
  const isClockedIn = today?.clock_in && !today?.clock_out;

  // Privacy rule: location is only ever reported while a work session is
  // open. The interval is created when clock-in flips isClockedIn to true
  // and torn down the moment it flips back (clock-out or unmount) - there is
  // no path that keeps this running for an employee who isn't working.
  useEffect(() => {
    if (!isClockedIn) {
      setTrackingActive(false);
      return;
    }

    let cancelled = false;

    const pingOnce = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          attendanceService
            .submitLocationPings([{
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              recorded_at: new Date().toISOString(),
            }])
            .then(() => { if (!cancelled) setTrackingActive(true); })
            .catch(() => { if (!cancelled) setTrackingActive(false); });
        },
        () => { if (!cancelled) setTrackingActive(false); },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    };

    pingOnce();
    const interval = window.setInterval(pingOnce, PING_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [isClockedIn]);

  const todayStatusText = today
    ? today.clock_in && today.clock_out
      ? 'Clocked Out'
      : getStatus(today.status).label
    : 'Not Clocked In';

  const locLabel = (s?: string, name?: string) =>
    s === 'office' ? 'Office' : s === 'site' ? (name || 'Work Site') : s === 'wfh' ? 'WFH' : null;

  return (
    <Box>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>Attendance</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Track your daily attendance with location verification</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => { refetch(); refetchStats(); }}>
              Refresh
            </Button>
            <Button
              variant={location ? 'contained' : 'outlined'}
              color={location ? 'success' : 'primary'}
              startIcon={<MyLocationIcon />}
              onClick={handleGetLocation}
              disabled={isGettingLocation}
              size="small"
            >
              {isGettingLocation ? 'Locating…' : location ? 'Location Set' : 'Get Location'}
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Location alerts */}
      {locationStatus && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setLocationStatus('')}>
          Location captured: {locationStatus}
        </Alert>
      )}
      {!location && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Location is optional - click "Get Location" to tag your clock-in/out with where you are.
        </Alert>
      )}

      {/* Today stat cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard label="Today's Status" index={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{todayStatusText}</Typography>
          {isClockedIn && today?.clock_in && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Since {new Date(today.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          )}
        </StatCard>
        <StatCard label="Today's Hours" index={2}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.02em' }}>
            {today?.total_hours?.toFixed(2) ?? '0.00'}h
          </Typography>
        </StatCard>
        <StatCard label="Status" index={3}>
          {today?.status
            ? <Chip label={getStatus(today.status).label} color={getStatus(today.status).color} size="small" />
            : <Typography variant="caption" color="text.secondary">—</Typography>}
        </StatCard>
        <StatCard label="Location" index={4}>
          {today?.location_status
            ? <Chip label={locLabel(today.location_status, today.location_name) ?? today.location_status} color={LOC_COLOR[today.location_status] ?? 'default'} size="small" icon={<LocationIcon />} />
            : location
              ? <Chip label="Ready" color="info" size="small" icon={<MyLocationIcon />} />
              : <Typography variant="caption" color="text.secondary">Not set</Typography>}
        </StatCard>
      </Box>

      {/* Clock actions */}
      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: '#fff', mb: 3, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="contained" color="success" size="small" startIcon={<LoginIcon />}
            onClick={() => clockInMutation.mutate()}
            disabled={!!today?.clock_in || clockInMutation.isPending}>
            {clockInMutation.isPending ? 'Clocking in…' : 'Clock In'}
          </Button>
          <Button variant="contained" color="error" size="small" startIcon={<LogoutIcon />}
            onClick={() => clockOutMutation.mutate()}
            disabled={!today?.clock_in || !!today?.clock_out || clockOutMutation.isPending}>
            {clockOutMutation.isPending ? 'Clocking out…' : 'Clock Out'}
          </Button>
          {isClockedIn && (
            <Chip
              size="small"
              icon={<TrackingIcon />}
              label={trackingActive ? 'Location Tracking Active' : 'Tracking…'}
              color={trackingActive ? 'success' : 'default'}
              variant="outlined"
            />
          )}
        </Box>
      </motion.div>

      {/* Date filters */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <TextField fullWidth label="Start Date" type="date" value={startDate} size="small"
          onChange={e => setStartDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField fullWidth label="End Date" type="date" value={endDate} size="small"
          onChange={e => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>

      {/* Attendance table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Table sx={{ minWidth: 600 }} size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#F8FAFC' }}>
              {['Date', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Location'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton height={20} /></TableCell>
                  ))}
                </TableRow>
              ))
              : (attendance as any[]).length > 0
                ? (attendance as any[]).map((record: any) => {
                  const s = getStatus(record.status);
                  return (
                    <TableRow key={record.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 500 }}>{new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</TableCell>
                      <TableCell>{record.clock_in ? new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                      <TableCell>
                        {record.clock_out
                          ? new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : record.clock_in
                            ? (
                              <Tooltip title="Forgot to clock out — fix it">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography variant="body2" color="text.secondary">—</Typography>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => { setFixTarget(record); setFixTime(`${record.date}T18:00`); }}
                                  >
                                    <MoreTimeIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Box>
                              </Tooltip>
                            )
                            : '—'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{record.total_hours?.toFixed(2) ?? '0.00'}h</TableCell>
                      <TableCell><Chip label={s.label} color={s.color} size="small" /></TableCell>
                      <TableCell>
                        {record.location_status
                          ? <Chip label={locLabel(record.location_status, record.location_name) ?? record.location_status} color={LOC_COLOR[record.location_status] ?? 'default'} size="small" variant="outlined" />
                          : <Typography variant="caption" color="text.secondary">—</Typography>}
                      </TableCell>
                    </TableRow>
                  );
                })
                : (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ border: 0 }}>
                      <EmptyState
                        title="No attendance records"
                        description="Records will appear here once you start clocking in."
                        compact
                      />
                    </TableCell>
                  </TableRow>
                )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={!!fixTarget} onClose={() => setFixTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Clock Out</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {fixTarget && `Clocked in ${new Date(fixTarget.clock_in).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. When did you actually leave?`}
          </Typography>
          <TextField
            fullWidth
            label="Clock Out Time"
            type="datetime-local"
            value={fixTime}
            onChange={(e) => setFixTime(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFixTarget(null)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            disabled={!fixTime || fixClockOutMutation.isPending}
            onClick={() => fixClockOutMutation.mutate()}
          >
            {fixClockOutMutation.isPending ? 'Saving…' : 'Clock Out'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Attendance;
