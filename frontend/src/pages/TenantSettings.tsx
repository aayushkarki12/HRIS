import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warehouse as WarehouseIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { tenantService, workLocationService } from '../services/api';

interface TenantSettingsFormData {
  name: string;
  subdomain: string;
  email: string;
  phone: string;
  address: string;
  logo_url: string;
  office_latitude: number | string;
  office_longitude: number | string;
  office_radius: number | string;
  office_address: string;
}

const getErrorMessage = (error: any): string => {
  if (!error) return 'An error occurred';
  if (typeof error === 'string') return error;
  
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((err: any) => err.msg || err).join(', ');
    }
    if (typeof detail === 'object') {
      return JSON.stringify(detail);
    }
    return String(detail);
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

const TenantSettings: React.FC = () => {
  const { tenant, user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [formData, setFormData] = useState<TenantSettingsFormData>({
    name: '',
    subdomain: '',
    email: '',
    phone: '',
    address: '',
    logo_url: '',
    office_latitude: '',
    office_longitude: '',
    office_radius: '',
    office_address: '',
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        subdomain: (tenant as any).subdomain || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        address: tenant.address || '',
        logo_url: tenant.logo_url || '',
        office_latitude: (tenant as any).office_latitude ?? '',
        office_longitude: (tenant as any).office_longitude ?? '',
        office_radius: (tenant as any).office_radius ?? '',
        office_address: (tenant as any).office_address || '',
      });
    }
  }, [tenant]);

 const updateTenantMutation = useMutation({
  mutationFn: async (data: TenantSettingsFormData) => {
    const cleanedData: any = {
      name: data.name,
      subdomain: data.subdomain,
      email: data.email,
      phone: data.phone,
      address: data.address,
      logo_url: data.logo_url,
      office_address: data.office_address || '',
    };
    
      // Office Latitude - convert to float or null
      if (data.office_latitude !== '' && data.office_latitude !== null && data.office_latitude !== undefined) {
        const parsed = parseFloat(data.office_latitude as string);
        cleanedData.office_latitude = !isNaN(parsed) ? parsed : null;
      } else {
        cleanedData.office_latitude = null;
      }
      
      // Office Longitude - convert to float or null
      if (data.office_longitude !== '' && data.office_longitude !== null && data.office_longitude !== undefined) {
        const parsed = parseFloat(data.office_longitude as string);
        cleanedData.office_longitude = !isNaN(parsed) ? parsed : null;
      } else {
        cleanedData.office_longitude = null;
      }
      
      // Office Radius - MUST be an integer (not null, not string)
      if (data.office_radius !== '' && data.office_radius !== null && data.office_radius !== undefined) {
        const parsed = parseInt(data.office_radius as string, 10);
        cleanedData.office_radius = !isNaN(parsed) ? parsed : 100;
      } else {
        cleanedData.office_radius = 100; // Default value (integer)
      }
      
      console.log('Sending to backend:', JSON.stringify(cleanedData, null, 2));
      const response = await tenantService.updateMyTenant(cleanedData);
      return response;
    },
    onSuccess: (data) => {
      toast.success('Organization settings updated successfully!');
      setSuccess('Settings saved successfully!');
      const updatedTenant = { ...tenant, ...data };
      localStorage.setItem('tenant', JSON.stringify(updatedTenant));
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      setError('');
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    updateTenantMutation.mutate(formData);
  };

  // ============ Work Locations ============
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [locationError, setLocationError] = useState('');
  const [locationForm, setLocationForm] = useState({
    name: '', address: '', latitude: '', longitude: '', radius: '100',
  });

  const { data: workLocations, isLoading: locationsLoading } = useQuery({
    queryKey: ['workLocations'],
    queryFn: workLocationService.getAll,
    enabled: isAdmin,
  });

  const createLocationMutation = useMutation({
    mutationFn: (data: any) => workLocationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workLocations'] });
      toast.success('Work location created');
      handleCloseLocationModal();
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err);
      toast.error(msg);
      setLocationError(msg);
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => workLocationService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workLocations'] });
      toast.success('Work location updated');
      handleCloseLocationModal();
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err);
      toast.error(msg);
      setLocationError(msg);
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (id: number) => workLocationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workLocations'] });
      toast.success('Work location deactivated');
    },
    onError: (err: any) => toast.error(getErrorMessage(err)),
  });

  const handleCloseLocationModal = () => {
    setLocationModalOpen(false);
    setEditingLocation(null);
    setLocationForm({ name: '', address: '', latitude: '', longitude: '', radius: '100' });
    setLocationError('');
  };

  const handleEditLocation = (loc: any) => {
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name,
      address: loc.address || '',
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radius: String(loc.radius),
    });
    setLocationModalOpen(true);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationForm((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        toast.success('Current location captured');
      },
      (err) => toast.error(err.message || 'Failed to get location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmitLocation = () => {
    setLocationError('');
    const lat = parseFloat(locationForm.latitude);
    const lng = parseFloat(locationForm.longitude);
    const radius = parseFloat(locationForm.radius) || 100;

    if (isNaN(lat) || isNaN(lng)) {
      setLocationError('Latitude and longitude must be valid numbers');
      return;
    }

    const payload = {
      name: locationForm.name,
      address: locationForm.address || null,
      latitude: lat,
      longitude: lng,
      radius,
    };

    if (editingLocation) {
      updateLocationMutation.mutate({ id: editingLocation.id, data: payload });
    } else {
      createLocationMutation.mutate(payload);
    }
  };

  const handleDeleteLocation = (loc: any) => {
    if (window.confirm(`Deactivate work location "${loc.name}"? Employees will no longer be able to clock in from there.`)) {
      deleteLocationMutation.mutate(loc.id);
    }
  };

  if (!isAdmin) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Card sx={{ maxWidth: 500, p: 3, textAlign: 'center' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom color="error">
              Access Denied
            </Typography>
            <Typography variant="body1" color="textSecondary">
              You don't have permission to view this page.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!tenant) {
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
            Organization Settings
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage your organization's profile and location settings
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BusinessIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h6">{tenant.name}</Typography>
            <Typography variant="caption" color="textSecondary">
              {tenant.subdomain}.hris-system.com
            </Typography>
          </Box>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 4 }}>
              <form onSubmit={handleSubmit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                  </Alert>
                )}
                {success && (
                  <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                    {success}
                  </Alert>
                )}

                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Organization Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Organization Name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Subdomain"
                      name="subdomain"
                      value={formData.subdomain}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      required
                      helperText="Subdomain for your organization's URL (e.g., company.hris-system.com)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Logo URL"
                      name="logo_url"
                      value={formData.logo_url}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      placeholder="https://example.com/logo.png"
                    />
                  </Grid>
                </Grid>

                <Typography variant="h6" sx={{ fontWeight: 600, mt: 4, mb: 2 }}>
                  <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Office Location
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Office Latitude"
                      name="office_latitude"
                      type="number"
                      value={formData.office_latitude}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      placeholder="e.g., 27.7172"
                      helperText="Latitude coordinate of your office (e.g., 27.7172)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Office Longitude"
                      name="office_longitude"
                      type="number"
                      value={formData.office_longitude}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      placeholder="e.g., 85.3240"
                      helperText="Longitude coordinate of your office (e.g., 85.3240)"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Office Radius (meters)"
                      name="office_radius"
                      type="number"
                      value={formData.office_radius}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      placeholder="100"
                      helperText="Distance in meters from office location (default: 100)"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Office Address"
                      name="office_address"
                      value={formData.office_address}
                      onChange={handleChange}
                      margin="normal"
                      size="small"
                      multiline
                      rows={2}
                      placeholder="Full office address"
                    />
                  </Grid>
                </Grid>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={updateTenantMutation.isPending}
                  startIcon={<SaveIcon />}
                  sx={{
                    mt: 4,
                    px: 4,
                    py: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
                    },
                  }}
                >
                  {updateTenantMutation.isPending ? <CircularProgress size={24} /> : 'Save Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Organization Info
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="textSecondary">Organization</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {tenant.name}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">Subdomain</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {tenant.subdomain}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="textSecondary">Status</Typography>
                  <Chip
                    label={tenant.is_active ? 'Active' : 'Inactive'}
                    color={tenant.is_active ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', mt: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                <LocationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Office Location
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(tenant as any).office_latitude && (tenant as any).office_longitude ? (
                  <>
                    <Box>
                      <Typography variant="caption" color="textSecondary">Coordinates</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {(tenant as any).office_latitude}, {(tenant as any).office_longitude}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="textSecondary">Radius</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {(tenant as any).office_radius || 100} meters
                      </Typography>
                    </Box>
                    {(tenant as any).office_address && (
                      <Box>
                        <Typography variant="caption" color="textSecondary">Address</Typography>
                        <Typography variant="body2">
                          {(tenant as any).office_address}
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No office location configured. Please set up your office location for attendance tracking.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  <WarehouseIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Work Locations
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setLocationModalOpen(true)}
                >
                  Add Location
                </Button>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Additional sites (warehouses, branch offices, client sites) where employees are allowed to clock in.
                Each has its own radius — employees within range of any active location are marked present at that site instead of "Working from Home".
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {locationsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell><strong>Name</strong></TableCell>
                        <TableCell><strong>Address</strong></TableCell>
                        <TableCell><strong>Coordinates</strong></TableCell>
                        <TableCell align="right"><strong>Radius</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell align="right"><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!workLocations || workLocations.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                            <Typography color="textSecondary">No additional work locations configured</Typography>
                          </TableCell>
                        </TableRow>
                      ) : workLocations.map((loc: any) => (
                        <TableRow key={loc.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{loc.name}</TableCell>
                          <TableCell>{loc.address || '-'}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                              {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{loc.radius}m</TableCell>
                          <TableCell>
                            <Chip
                              label={loc.is_active ? 'Active' : 'Inactive'}
                              color={loc.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="primary" onClick={() => handleEditLocation(loc)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            {loc.is_active && (
                              <IconButton size="small" color="error" onClick={() => handleDeleteLocation(loc)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Work Location Dialog */}
      <Dialog open={locationModalOpen} onClose={handleCloseLocationModal} maxWidth="sm" fullWidth>
        <DialogTitle>{editingLocation ? 'Edit Work Location' : 'Add Work Location'}</DialogTitle>
        <DialogContent>
          {locationError && <Alert severity="error" sx={{ mb: 2 }}>{locationError}</Alert>}
          <TextField
            fullWidth
            label="Location Name"
            value={locationForm.name}
            onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
            margin="normal"
            size="small"
            placeholder="e.g. Hetauda Warehouse"
          />
          <TextField
            fullWidth
            label="Address"
            value={locationForm.address}
            onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
            margin="normal"
            size="small"
            placeholder="Optional"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Latitude"
              type="number"
              value={locationForm.latitude}
              onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })}
              margin="normal"
              size="small"
              fullWidth
              placeholder="e.g. 27.4287"
            />
            <TextField
              label="Longitude"
              type="number"
              value={locationForm.longitude}
              onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })}
              margin="normal"
              size="small"
              fullWidth
              placeholder="e.g. 85.0322"
            />
          </Box>
          <Button size="small" startIcon={<LocationIcon />} onClick={handleUseMyLocation} sx={{ mt: 1 }}>
            Use My Current Location
          </Button>
          <TextField
            fullWidth
            label="Radius (meters)"
            type="number"
            value={locationForm.radius}
            onChange={(e) => setLocationForm({ ...locationForm, radius: e.target.value })}
            margin="normal"
            size="small"
            helperText="How close an employee must be to clock in at this location"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLocationModal}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitLocation}
            disabled={!locationForm.name || !locationForm.latitude || !locationForm.longitude || createLocationMutation.isPending || updateLocationMutation.isPending}
          >
            {createLocationMutation.isPending || updateLocationMutation.isPending
              ? 'Saving...'
              : editingLocation ? 'Update Location' : 'Create Location'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TenantSettings;