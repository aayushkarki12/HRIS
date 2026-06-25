import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link,
  Divider,
  Fade,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

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
  });
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

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

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const registrationData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || '1234567890',
        department: formData.department || 'General',
        position: formData.position || 'Staff',
        join_date: formData.join_date || new Date().toISOString().split('T')[0],
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
        });
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
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
        <Fade in={true} timeout={500}>
          <Paper
            elevation={12}
            sx={{
              padding: 4,
              borderRadius: 3,
              background: 'white',
              maxWidth: '550px',
              margin: '0 auto',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <Box sx={{ textAlign: 'center', marginBottom: 3 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  marginBottom: 1.5,
                }}
              >
                <PersonAddIcon sx={{ fontSize: 28, color: 'white' }} />
              </Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: 0.5,
                }}
              >
                Create Account
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Join HRIS System today
              </Typography>
            </Box>

            <Divider sx={{ marginBottom: 2.5 }} />

            {error && (
              <Alert 
                severity="error" 
                sx={{ marginBottom: 2, borderRadius: 1.5 }}
                onClose={() => setError('')}
              >
                {error}
              </Alert>
            )}

            {success && (
              <Alert 
                severity="success" 
                sx={{ marginBottom: 2, borderRadius: 1.5 }}
                onClose={() => setSuccess('')}
              >
                {success}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              {/* First Name & Last Name - Side by side */}
              <Box sx={{ display: 'flex', gap: 2, marginBottom: 1.5 }}>
                <TextField
                  fullWidth
                  label="First Name *"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  size="small"
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
                />
              </Box>

              {/* Email */}
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
                sx={{ marginBottom: 1.5 }}
              />

              {/* Username */}
              <TextField
                fullWidth
                label="Username *"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                variant="outlined"
                size="small"
                helperText="Username must be alphanumeric"
                sx={{ marginBottom: 1.5 }}
              />

              {/* Password & Confirm Password - Side by side */}
              <Box sx={{ display: 'flex', gap: 2, marginBottom: 1.5 }}>
                <TextField
                  fullWidth
                  label="Password *"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  size="small"
                  helperText="Min 6 characters"
                />
                <TextField
                  fullWidth
                  label="Confirm Password *"
                  name="confirm_password"
                  type="password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  required
                  variant="outlined"
                  size="small"
                />
              </Box>

              {/* Phone */}
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
                sx={{ marginBottom: 1.5 }}
              />

              {/* Department & Position - Side by side */}
              <Box sx={{ display: 'flex', gap: 2, marginBottom: 1.5 }}>
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

              {/* Join Date - Fixed InputLabelProps issue */}
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
                  inputLabel: {
                    shrink: true,
                  },
                }}
                sx={{ marginBottom: 2 }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  paddingY: 1.2,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  },
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', marginTop: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Already have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/login"
                  underline="hover"
                  sx={{
                    fontWeight: 600,
                    color: '#667eea',
                    '&:hover': {
                      color: '#764ba2',
                    },
                  }}
                >
                  Sign In
                </Link>
              </Typography>
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
};

export default Register;