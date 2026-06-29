import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Box,
  InputAdornment,
  IconButton,
  MenuItem,
  Divider,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    confirm_password: '',
    phone: '',
    department: 'General',
    position: 'Staff',
    join_date: new Date().toISOString().split('T')[0],
    tenant_subdomain: 'default', // Add tenant subdomain field
  });
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Fetch available tenants (for admin or tenant selection)
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/tenants`);
      return response.data;
    },
    enabled: false, // Only enable for admin users
  });

  const departments = [
    'General',
    'Engineering',
    'Human Resources',
    'Finance',
    'Marketing',
    'Sales',
    'Operations',
    'IT',
    'Legal',
    'Administration',
  ];

  const positions = [
    'Staff',
    'Junior Developer',
    'Senior Developer',
    'Team Lead',
    'Manager',
    'Director',
    'VP',
    'Executive',
    'Intern',
    'Consultant',
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate passwords match
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      // Prepare registration data with tenant info
      const registrationData = {
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || '1234567890',
        department: formData.department || 'General',
        position: formData.position || 'Staff',
        join_date: formData.join_date || new Date().toISOString().split('T')[0],
        tenant_subdomain: formData.tenant_subdomain || 'default',
      };

      console.log('Sending registration data:', registrationData);

      const result = await register(registrationData);
      
      if (result.success) {
        setSuccess('Registration successful! You can now login.');
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          username: '',
          password: '',
          confirm_password: '',
          phone: '',
          department: 'General',
          position: 'Staff',
          join_date: new Date().toISOString().split('T')[0],
          tenant_subdomain: 'default',
        });
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      let errorMsg = 'An unexpected error occurred. Please try again.';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map((d: any) => d.msg).join(', ');
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            maxHeight: '90vh',
            overflow: 'auto',
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                mb: 1.5,
              }}
            >
              <BusinessIcon sx={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                mb: 0.5,
              }}
            >
              Create Account
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Join HRIS System today
            </Typography>
          </Box>

          <Divider sx={{ mb: 2.5 }} />

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 1.5 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {/* Tenant/Organization Field */}
            <TextField
              fullWidth
              label="Organization Subdomain *"
              name="tenant_subdomain"
              value={formData.tenant_subdomain}
              onChange={handleChange}
              required
              variant="outlined"
              size="small"
              sx={{ mb: 1.5 }}
              helperText="Enter your organization's unique subdomain (e.g., 'mycompany')"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
              <TextField
                fullWidth
                label="First Name *"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Last Name *"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                variant="outlined"
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <TextField
              fullWidth
              label="Email *"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              variant="outlined"
              size="small"
              sx={{ mb: 1.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Username *"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              variant="outlined"
              size="small"
              sx={{ mb: 1.5 }}
              helperText="Username must be alphanumeric"
            />

            <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
              <TextField
                fullWidth
                label="Password *"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                variant="outlined"
                size="small"
                helperText="Min 6 characters"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Confirm Password *"
                name="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirm_password}
                onChange={handleChange}
                required
                variant="outlined"
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                        edge="end" 
                        size="small"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              variant="outlined"
              size="small"
              placeholder="1234567890"
              helperText="Optional but recommended"
              sx={{ mb: 1.5 }}
            />

            <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
              <TextField
                fullWidth
                select
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                variant="outlined"
                size="small"
              >
                {departments.map((dept) => (
                  <MenuItem key={dept} value={dept}>
                    {dept}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                select
                label="Position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                variant="outlined"
                size="small"
              >
                {positions.map((pos) => (
                  <MenuItem key={pos} value={pos}>
                    {pos}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <TextField
              fullWidth
              label="Join Date"
              name="join_date"
              type="date"
              value={formData.join_date}
              onChange={handleChange}
              variant="outlined"
              size="small"
              slotProps={{
                inputLabel: { shrink: true },
              }}
              sx={{ mb: 2 }}
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                py: 1.2,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </form>

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Already have an account?{' '}
              <Button
                component={RouterLink}
                to="/login"
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#667eea',
                  '&:hover': { color: '#764ba2' },
                }}
              >
                Sign In
              </Button>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Register;