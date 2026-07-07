import React, { useState } from 'react';
import {
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
import { motion } from 'framer-motion';

const DEPARTMENTS = ['General','Engineering','Human Resources','Finance','Marketing','Sales','Operations','IT','Legal','Administration'];
const POSITIONS   = ['Staff','Junior Developer','Senior Developer','Team Lead','Manager','Director','VP','Executive','Intern','Consultant'];

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', username: '',
    password: '', confirm_password: '', phone: '',
    department: 'General', position: 'Staff',
    join_date: new Date().toISOString().split('T')[0],
    tenant_subdomain: 'default',
  });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) { setError('Passwords do not match'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await register({
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
      });
      if (result.success) {
        setSuccess('Account created! Redirecting to sign in…');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#F8FAFC' }}>
      {/* Left panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '0 0 380px',
          bgcolor: 'primary.main',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Box sx={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
        <Box sx={{ width: 48, height: 48, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>H</Typography>
        </Box>
        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1.5, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          Join HRIS System
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          Create your account and start managing your HR operations efficiently.
        </Typography>
      </Box>

      {/* Right panel — form */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 2, sm: 4 }, py: 4, overflowY: 'auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{ width: '100%', maxWidth: 460 }}
        >
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 3 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.875rem' }}>H</Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>HRIS System</Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 0.5 }}>Create an account</Typography>
            <Typography variant="body2" color="text.secondary">Fill in the details below to get started</Typography>
          </Box>

          {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <form onSubmit={handleSubmit}>
            {/* Organization */}
            <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.65rem', letterSpacing: '0.08em', mb: 1, display: 'block' }}>
              Organization
            </Typography>
            <TextField
              fullWidth label="Organization Subdomain" name="tenant_subdomain"
              value={formData.tenant_subdomain} onChange={handleChange}
              required size="small" sx={{ mb: 2.5 }}
              helperText="Your organization's unique subdomain (e.g. 'mycompany')"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><BusinessIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> } }}
            />

            {/* Personal info */}
            <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.65rem', letterSpacing: '0.08em', mb: 1, display: 'block' }}>
              Personal Info
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
              <TextField fullWidth label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} required size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> } }} />
              <TextField fullWidth label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} required size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> } }} />
            </Box>
            <TextField fullWidth label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required size="small" sx={{ mb: 1.5 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> } }} />
            <TextField fullWidth label="Phone" name="phone" value={formData.phone} onChange={handleChange} size="small" sx={{ mb: 2.5 }} placeholder="Optional" />

            {/* Account */}
            <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.65rem', letterSpacing: '0.08em', mb: 1, display: 'block' }}>
              Account Credentials
            </Typography>
            <TextField fullWidth label="Username" name="username" value={formData.username} onChange={handleChange} required size="small" sx={{ mb: 1.5 }}
              helperText="Alphanumeric, no spaces" />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
              <TextField fullWidth label="Password" name="password" type={showPwd ? 'text' : 'password'} value={formData.password} onChange={handleChange} required size="small" helperText="Min 6 chars"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPwd(!showPwd)} edge="end" size="small">{showPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}</IconButton></InputAdornment> } }} />
              <TextField fullWidth label="Confirm Password" name="confirm_password" type={showConfirmPwd ? 'text' : 'password'} value={formData.confirm_password} onChange={handleChange} required size="small"
                slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowConfirmPwd(!showConfirmPwd)} edge="end" size="small">{showConfirmPwd ? <VisibilityOff sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}</IconButton></InputAdornment> } }} />
            </Box>

            {/* HR Info */}
            <Typography variant="overline" color="text.disabled" sx={{ fontSize: '0.65rem', letterSpacing: '0.08em', mb: 1, display: 'block' }}>
              HR Details
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1.5 }}>
              <TextField fullWidth select label="Department" name="department" value={formData.department} onChange={handleChange} size="small">
                {DEPARTMENTS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
              <TextField fullWidth select label="Job Title" name="position" value={formData.position} onChange={handleChange} size="small">
                {POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Box>
            <TextField fullWidth label="Join Date" name="join_date" type="date" value={formData.join_date} onChange={handleChange} size="small" sx={{ mb: 3 }}
              slotProps={{ inputLabel: { shrink: true } }} />

            <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 1.25, fontWeight: 600 }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Create Account'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" color="text.secondary" align="center">
            Already have an account?{' '}
            <Button component={RouterLink} to="/login" size="small" sx={{ fontWeight: 600, p: 0, minWidth: 0, verticalAlign: 'baseline' }}>
              Sign In
            </Button>
          </Typography>
        </motion.div>
      </Box>
    </Box>
  );
};

export default Register;
