import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Chip, TextField, MenuItem,
  ToggleButton, ToggleButtonGroup, List, ListItemButton, ListItemText,
  Avatar, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Skeleton, Alert,
} from '@mui/material';
import { MapContainer, TileLayer, Circle, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import { attendanceService, workLocationService, getErrorMessage } from '../services/api';
import EmptyState from '../components/common/EmptyState';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.05 } }),
};

// Kathmandu - fallback map center when no employee/office location is known yet.
const DEFAULT_CENTER = { lat: 27.7172, lng: 85.324 };

// Free - OpenStreetMap tiles, no API key or billing required (matches
// components/common/LocationPickerMap.tsx, the other map in this app).
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Leaflet's MapContainer only reads center/zoom on first mount - this pans
 * the live map instance whenever the selected employee (or the fallback
 * center) changes, instead of a full remount that would lose zoom gestures
 * mid-interaction. */
const MapRecenter: React.FC<{ center: { lat: number; lng: number }; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo([center.lat, center.lng], zoom, { duration: 0.5 });
  }, [center.lat, center.lng, zoom, map]);
  return null;
};

const LOC_LABEL: Record<string, string> = { office: 'Office', site: 'Site', wfh: 'Remote', unknown: 'Unknown' };
const LOC_COLOR: Record<string, 'success' | 'primary' | 'warning' | 'default'> = {
  office: 'success', site: 'primary', wfh: 'warning', unknown: 'default',
};

type CheckedInEmployee = {
  id: number;
  name: string;
  department: string;
  position: string;
  attendance_type: string;
  clock_in: string | null;
  location_status: string | null;
  fixed_clock_in_time: string | null;
};

type LiveLocation = {
  employee_id: number;
  employee_name: string;
  employee_code: string | null;
  device_status: 'online' | 'offline' | 'no_data';
  minutes_since_last_ping: number | null;
  clocked_in: boolean;
  last_ping: {
    id: number;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    location_status: string;
    location_name: string | null;
    recorded_at: string;
  } | null;
};

const StatCard: React.FC<{ label: string; value: React.ReactNode; index: number }> = ({ label, value, index }) => (
  <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
    <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' }}>
      <CardContent sx={{ textAlign: 'center', py: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.secondary', fontSize: '0.675rem' }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 1, letterSpacing: '-0.02em' }}>{value}</Typography>
      </CardContent>
    </Card>
  </motion.div>
);

const formatDuration = (clockIn: string | null): string => {
  if (!clockIn) return '—';
  const ms = Date.now() - new Date(clockIn).getTime();
  if (ms < 0) return '—';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
};

const formatMinutesAgo = (minutes: number | null): string => {
  if (minutes === null) return 'never';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  return `${Math.round(minutes / 60)}h ago`;
};

const WorkLocation: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'office' | 'remote'>('all');
  const [department, setDepartment] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<number | null>(null);

  const { data: liveLocations = [], isLoading: loadingLive, error: liveError } = useQuery<LiveLocation[]>({
    queryKey: ['work-location', 'live-locations'],
    queryFn: attendanceService.getLiveLocations,
    // Live map, not real-time infra - the codebase's existing pattern everywhere
    // else is polling, so this refreshes on the same principle.
    refetchInterval: 30_000,
  });

  const { data: overview } = useQuery({
    queryKey: ['work-location', 'today-overview'],
    queryFn: attendanceService.getTodayOverview,
    refetchInterval: 30_000,
  });

  const { data: workLocations = [] } = useQuery({
    queryKey: ['work-location', 'sites'],
    queryFn: workLocationService.getAll,
    staleTime: 5 * 60_000,
  });

  const { data: historyPoints, isLoading: loadingHistory } = useQuery({
    queryKey: ['work-location', 'history', historyEmployeeId],
    queryFn: () => attendanceService.getLocationHistory(historyEmployeeId as number, { limit: 100 }),
    enabled: historyEmployeeId !== null,
  });

  const checkedInById = useMemo(() => {
    const map = new Map<number, CheckedInEmployee>();
    (overview?.checked_in_employees ?? []).forEach((e: CheckedInEmployee) => map.set(e.id, e));
    return map;
  }, [overview]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    checkedInById.forEach((e) => { if (e.department) set.add(e.department); });
    return Array.from(set).sort();
  }, [checkedInById]);

  // Only employees currently working appear on the map/list - tracking never
  // happens outside an active work session, so there's nothing to show for
  // anyone else.
  const working = useMemo(
    () => liveLocations.filter((l) => l.clocked_in),
    [liveLocations],
  );

  const summary = useMemo(() => {
    let office = 0, remote = 0, trackingActive = 0;
    working.forEach((l) => {
      const status = checkedInById.get(l.employee_id)?.location_status ?? l.last_ping?.location_status ?? 'unknown';
      if (status === 'office') office += 1; else remote += 1;
      if (l.device_status === 'online') trackingActive += 1;
    });
    return { working: working.length, office, remote, trackingActive };
  }, [working, checkedInById]);

  const filtered = useMemo(() => {
    return working.filter((l) => {
      const emp = checkedInById.get(l.employee_id);
      const status = emp?.location_status ?? l.last_ping?.location_status ?? 'unknown';
      if (statusFilter === 'office' && status !== 'office') return false;
      if (statusFilter === 'remote' && status === 'office') return false;
      if (department !== 'all' && emp?.department !== department) return false;
      if (search && !l.employee_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [working, checkedInById, statusFilter, department, search]);

  const selected = filtered.find((l) => l.employee_id === selectedEmployeeId) ?? null;
  const selectedEmp = selected ? checkedInById.get(selected.employee_id) : undefined;

  const officeSite = (workLocations as any[]).find(() => true);
  const mapCenter = selected?.last_ping
    ? { lat: selected.last_ping.latitude, lng: selected.last_ping.longitude }
    : filtered[0]?.last_ping
      ? { lat: filtered[0].last_ping.latitude, lng: filtered[0].last_ping.longitude }
      : officeSite
        ? { lat: officeSite.latitude, lng: officeSite.longitude }
        : DEFAULT_CENTER;

  return (
    <Box>
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>Work &amp; Location</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Who's working right now, office vs. remote, and where they are
          </Typography>
        </Box>
      </motion.div>

      {liveError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {getErrorMessage(liveError, 'Failed to load live locations')}
        </Alert>
      )}

      {/* Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard label="Currently Working" value={loadingLive ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : summary.working} index={1} />
        <StatCard label="Office" value={loadingLive ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : summary.office} index={2} />
        <StatCard label="Remote" value={loadingLive ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : summary.remote} index={3} />
        <StatCard label="Tracking Active" value={loadingLive ? <Skeleton width={40} sx={{ mx: 'auto' }} /> : summary.trackingActive} index={4} />
      </Box>

      {/* Filters */}
      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={statusFilter}
            onChange={(_, v) => v && setStatusFilter(v)}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="office">Office</ToggleButton>
            <ToggleButton value="remote">Remote</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            select size="small" label="Department" value={department}
            onChange={(e) => setDepartment(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">All Departments</MenuItem>
            {departments.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </TextField>
          <TextField
            size="small" label="Search employee" value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
        </Box>
      </motion.div>

      {/* Map + list */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 340px' }, gap: 2 }}>
        <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: 520 }}>
          <MapContainer
            center={mapCenter}
            zoom={selected ? 15 : 12}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <MapRecenter center={mapCenter} zoom={selected ? 15 : 12} />

            {(workLocations as any[]).map((loc) => (
              <Circle
                key={loc.id}
                center={[loc.latitude, loc.longitude]}
                radius={loc.radius}
                pathOptions={{ color: '#334155', opacity: 0.5, weight: 1, fillColor: '#334155', fillOpacity: 0.08 }}
              />
            ))}

            {filtered.filter((l) => l.last_ping).map((l) => (
              <CircleMarker
                key={l.employee_id}
                center={[l.last_ping!.latitude, l.last_ping!.longitude]}
                radius={8}
                pathOptions={{
                  color: '#FFFFFF', weight: 2,
                  fillColor: l.device_status === 'online' ? '#16A34A' : '#94A3B8',
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => setSelectedEmployeeId(l.employee_id) }}
              />
            ))}
          </MapContainer>
        </Box>

        {/* Employee list */}
        <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: '#fff', maxHeight: 520, overflowY: 'auto' }}>
          <Typography variant="overline" sx={{ px: 2, pt: 2, display: 'block', color: 'text.disabled' }}>
            Currently Working ({filtered.length})
          </Typography>
          {loadingLive ? (
            <Box sx={{ p: 2 }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} />)}
            </Box>
          ) : filtered.length === 0 ? (
            <EmptyState title="No one matches these filters" compact />
          ) : (
            <List disablePadding sx={{ px: 1, pb: 1 }}>
              {filtered.map((l) => {
                const emp = checkedInById.get(l.employee_id);
                const status = emp?.location_status ?? l.last_ping?.location_status ?? 'unknown';
                return (
                  <ListItemButton
                    key={l.employee_id}
                    selected={selectedEmployeeId === l.employee_id}
                    onClick={() => setSelectedEmployeeId(l.employee_id)}
                    sx={{ borderRadius: 1.5, mb: 0.5 }}
                  >
                    <Avatar
                      sx={{
                        width: 28, height: 28, mr: 1.5, fontSize: '0.7rem',
                        bgcolor: l.device_status === 'online' ? '#DCFCE7' : '#F1F5F9',
                        color: l.device_status === 'online' ? '#15803D' : '#64748B',
                      }}
                    >
                      {l.employee_name.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <ListItemText
                      primary={l.employee_name}
                      secondary={`${LOC_LABEL[status] ?? status} · Updated ${formatMinutesAgo(l.minutes_since_last_ping)}`}
                      slotProps={{
                        primary: { sx: { fontSize: '0.8125rem', fontWeight: 600 } },
                        secondary: { sx: { fontSize: '0.7rem' } },
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Box>
      </Box>

      {/* Employee detail dialog */}
      <Dialog open={selectedEmployeeId !== null} onClose={() => setSelectedEmployeeId(null)} maxWidth="xs" fullWidth>
        {selected && (
          <>
            <DialogTitle>{selected.employee_name}</DialogTitle>
            <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {selectedEmp && (
                <Typography variant="body2" color="text.secondary">{selectedEmp.department} · {selectedEmp.position}</Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                <Chip size="small" label={selected.device_status === 'online' ? 'Tracking Active' : 'Tracking Stale'} color={selected.device_status === 'online' ? 'success' : 'default'} />
                <Chip
                  size="small"
                  label={LOC_LABEL[selectedEmp?.location_status ?? selected.last_ping?.location_status ?? 'unknown']}
                  color={LOC_COLOR[selectedEmp?.location_status ?? selected.last_ping?.location_status ?? 'unknown']}
                />
              </Box>
              <Typography variant="body2">Started: {selectedEmp?.clock_in ? new Date(selectedEmp.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</Typography>
              <Typography variant="body2">Working: {formatDuration(selectedEmp?.clock_in ?? null)}</Typography>
              <Typography variant="body2">Location: {selected.last_ping?.location_name || 'Unnamed location'}</Typography>
              <Typography variant="body2">Last updated: {formatMinutesAgo(selected.minutes_since_last_ping)}</Typography>
              {selected.last_ping?.accuracy != null && (
                <Typography variant="body2">Accuracy: ±{Math.round(selected.last_ping.accuracy)}m</Typography>
              )}

              {historyEmployeeId === selected.employee_id && (
                <Box sx={{ mt: 1, maxHeight: 180, overflowY: 'auto', borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                  {loadingHistory ? (
                    <Skeleton height={80} />
                  ) : (historyPoints ?? []).length === 0 ? (
                    <Typography variant="caption" color="text.secondary">No location history yet today.</Typography>
                  ) : (
                    (historyPoints ?? []).map((p: any) => (
                      <Typography key={p.id} variant="caption" sx={{ display: 'block' }} color="text.secondary">
                        {new Date(p.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {p.location_name || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                      </Typography>
                    ))
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              {historyEmployeeId !== selected.employee_id && (
                <Button size="small" onClick={() => setHistoryEmployeeId(selected.employee_id)}>
                  View Today's History
                </Button>
              )}
              <Button size="small" onClick={() => setSelectedEmployeeId(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default WorkLocation;
