import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  TextField,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Coffee as CoffeeIcon,
  CoffeeMaker as CoffeeMakerIcon,
  CheckCircle as CheckCircleIcon,
  MyLocation as MyLocationIcon,
  LocationOn as LocationIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  HolidayVillage as HolidayIcon,
  BeachAccess as LeaveIcon,
} from '@mui/icons-material';
import { attendanceService } from '../services/api';

const Attendance: React.FC = () => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [error, setError] = useState<string>('');
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const { data: attendance, isLoading, refetch } = useQuery({
    queryKey: ['attendance', startDate, endDate],
    queryFn: () => attendanceService.getMyAttendance(startDate, endDate),
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['attendanceStats'],
    queryFn: attendanceService.getStats,
  });

  const getLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error(error.message));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleGetLocation = async () => {
    setIsGettingLocation(true);
    setError('');
    try {
      const pos = await getLocation();
      setLocation(pos);
      setLocationStatus(`Location captured: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
      toast.success('Location captured successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to get location');
      setLocationStatus('Location unavailable');
      setError(err.message || 'Failed to get location');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const clockInMutation = useMutation({
    mutationFn: () => {
      if (!location) {
        throw new Error('Please get your location first');
      }
      return attendanceService.clockIn(location.lat, location.lng);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceStats'] });
      toast.success(`Clocked in! Status: ${data.status}`);
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to clock in';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: () => {
      if (!location) {
        throw new Error('Please get your location first');
      }
      return attendanceService.clockOut(location.lat, location.lng);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceStats'] });
      toast.success(`Clocked out! ${data.total_hours}h worked`);
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to clock out';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const startBreakMutation = useMutation({
    mutationFn: (breakType: string) => attendanceService.startBreak(breakType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Break started');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to start break';
      toast.error(errorMsg);
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: attendanceService.endBreak,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`Break ended! ${data.duration_minutes} minutes`);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to end break';
      toast.error(errorMsg);
    },
  });

  const today = attendance?.find((a: any) => a.date === new Date().toISOString().split('T')[0]);
  const isClockedIn = today?.clock_in && !today?.clock_out;

  const getDisplayStatus = (status: string) => {
    const statusMap: Record<string, { label: string; color: any; icon: any }> = {
      present: { 
        label: 'Present', 
        color: 'success', 
        icon: <CheckCircleIcon fontSize="small" /> 
      },
      absent: { 
        label: 'Absent', 
        color: 'error', 
        icon: <CancelIcon fontSize="small" /> 
      },
      late: { 
        label: 'Late', 
        color: 'warning', 
        icon: <WarningIcon fontSize="small" /> 
      },
      'half-day': { 
        label: 'Half Day', 
        color: 'info', 
        icon: <AccessTimeIcon fontSize="small" /> 
      },
      holiday: { 
        label: 'Holiday', 
        color: 'secondary', 
        icon: <HolidayIcon fontSize="small" /> 
      },
      leave: { 
        label: 'Leave', 
        color: 'default', 
        icon: <LeaveIcon fontSize="small" /> 
      },
      left: { 
        label: 'Clocked Out', 
        color: 'default', 
        icon: <LogoutIcon fontSize="small" /> 
      },
      'not_clocked': { 
        label: 'Not Clocked In', 
        color: 'default', 
        icon: null 
      },
    };
    return statusMap[status] || { label: 'Not Set', color: 'default', icon: null };
  };

  const getLocationIcon = (status: string) => {
    switch (status) {
      case 'office': return <LocationIcon fontSize="small" color="success" />;
      case 'wfh': return <MyLocationIcon fontSize="small" color="warning" />;
      default: return <LocationIcon fontSize="small" color="disabled" />;
    }
  };

  const getTodayStatusText = () => {
    if (!today) return 'Not Clocked In';
    if (today.clock_in && today.clock_out) {
      return today.status === 'left' ? 'Clocked Out' : getDisplayStatus(today.status).label;
    }
    if (today.clock_in && !today.clock_out) {
      return getDisplayStatus(today.status).label;
    }
    return 'Not Clocked In';
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
            Attendance
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Track your daily attendance with location verification
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => {
              refetch();
              refetchStats();
            }}
          >
            Refresh
          </Button>
          <Button
            variant={location ? "contained" : "outlined"}
            color={location ? "success" : "primary"}
            startIcon={<MyLocationIcon />}
            onClick={handleGetLocation}
            disabled={isGettingLocation}
            size="small"
          >
            {isGettingLocation ? 'Getting...' : (location ? 'Location Set' : 'Get Location')}
          </Button>
        </Box>
      </Box>

      {locationStatus && (
        <Alert severity={location ? "success" : "warning"} sx={{ mb: 2 }} onClose={() => setLocationStatus('')}>
          {locationStatus}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {!location && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Please click the "Get Location" button above to enable location-based attendance tracking.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
        <Card sx={{ borderRadius: 3, textAlign: 'center' }}>
          <CardContent>
            <Typography variant="caption" color="textSecondary">Today's Status</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
              {getTodayStatusText()}
            </Typography>
            {isClockedIn && today?.clock_in && (
              <Typography variant="caption" color="textSecondary">
                Since: {new Date(today.clock_in).toLocaleTimeString()}
              </Typography>
            )}
            {today?.clock_out && (
              <Typography variant="caption" color="textSecondary">
                Clocked out: {new Date(today.clock_out).toLocaleTimeString()}
              </Typography>
            )}
          </CardContent>
        </Card>
        <Card sx={{ borderRadius: 3, textAlign: 'center' }}>
          <CardContent>
            <Typography variant="caption" color="textSecondary">Today's Hours</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 1, color: '#667eea' }}>
              {today?.total_hours?.toFixed(2) || '0.00'}h
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ borderRadius: 3, textAlign: 'center' }}>
          <CardContent>
            <Typography variant="caption" color="textSecondary">Status</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip
                label={today?.status ? getDisplayStatus(today.status).label : 'Not Set'}
                color={today?.status ? getDisplayStatus(today.status).color as any : 'default'}
                icon={today?.status ? getDisplayStatus(today.status).icon : undefined}
                size="medium"
              />
            </Box>
          </CardContent>
        </Card>
        <Card sx={{ borderRadius: 3, textAlign: 'center' }}>
          <CardContent>
            <Typography variant="caption" color="textSecondary">Location</Typography>
            <Box sx={{ mt: 1 }}>
              <Chip
                icon={getLocationIcon(today?.location_status)}
                label={today?.location_status === 'office' ? 'Office' : 
                       today?.location_status === 'wfh' ? 'WFH' : 
                       location ? 'Ready' : 'Not Set'}
                color={today?.location_status === 'office' ? 'success' : 
                       today?.location_status === 'wfh' ? 'warning' : 
                       location ? 'info' : 'default'}
                size="medium"
              />
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<LoginIcon />}
            onClick={() => clockInMutation.mutate()}
            disabled={!!today?.clock_in || clockInMutation.isPending || !location}
          >
            {clockInMutation.isPending ? '...' : 'Clock In'}
          </Button>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<LogoutIcon />}
            onClick={() => clockOutMutation.mutate()}
            disabled={!today?.clock_in || !!today?.clock_out || clockOutMutation.isPending || !location}
          >
            {clockOutMutation.isPending ? '...' : 'Clock Out'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CoffeeIcon />}
            onClick={() => startBreakMutation.mutate('coffee')}
            disabled={!isClockedIn || startBreakMutation.isPending}
          >
            {startBreakMutation.isPending ? '...' : 'Coffee Break'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CoffeeMakerIcon />}
            onClick={() => startBreakMutation.mutate('lunch')}
            disabled={!isClockedIn || startBreakMutation.isPending}
          >
            {startBreakMutation.isPending ? '...' : 'Lunch Break'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<CheckCircleIcon />}
            onClick={() => endBreakMutation.mutate()}
            disabled={!isClockedIn || endBreakMutation.isPending}
          >
            {endBreakMutation.isPending ? '...' : 'End Break'}
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <TextField
          fullWidth
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth
          label="End Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Clock In</strong></TableCell>
              <TableCell><strong>Clock Out</strong></TableCell>
              <TableCell><strong>Hours</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>Breaks</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {attendance && attendance.length > 0 ? (
              attendance.map((record: any) => {
                const statusInfo = getDisplayStatus(record.status);
                return (
                  <TableRow key={record.id} hover>
                    <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : '-'}
                    </TableCell>
                    <TableCell>
                      {record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : '-'}
                    </TableCell>
                    <TableCell>{record.total_hours?.toFixed(2) || '0.00'}h</TableCell>
                    <TableCell>
                      <Chip
                        label={statusInfo.label}
                        color={statusInfo.color as any}
                        icon={statusInfo.icon}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getLocationIcon(record.location_status)}
                        label={record.location_status === 'office' ? 'Office' : 
                               record.location_status === 'wfh' ? 'WFH' : 
                               'Unknown'}
                        color={record.location_status === 'office' ? 'success' : 
                               record.location_status === 'wfh' ? 'warning' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {record.breaks && record.breaks.length > 0 ? (
                        record.breaks.map((b: any, i: number) => (
                          <Chip
                            key={i}
                            label={`${b.break_type} (${b.duration?.toFixed(0) || 0}min)`}
                            size="small"
                            variant="outlined"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))
                      ) : (
                        <Typography variant="caption" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
                    No attendance records found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Attendance;