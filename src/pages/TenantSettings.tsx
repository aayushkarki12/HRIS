import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@mui/material';
import {
  Save as SaveIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { tenantService } from '../services/api';

interface TenantSettingsFormData {
  name: string;
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
                      inputProps={{ step: "0.000001" }}
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
                      inputProps={{ step: "0.000001" }}
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
                      inputProps={{ min: "0", step: "10" }}
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
      </Grid>
    </Box>
  );
};

export default TenantSettings;