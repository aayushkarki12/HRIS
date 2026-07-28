import React, { useEffect, useState } from 'react';
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
  Divider,
  Chip,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LockIcon from '@mui/icons-material/Lock';
import BadgeIcon from '@mui/icons-material/Badge';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { authService, getErrorMessage } from '../services/api';

interface InvitationDetails {
  first_name: string;
  last_name: string;
  email: string;
  employee_id: string;
  department: string;
  position: string;
  designation?: string | null;
  seniority_level?: string | null;
  joining_date?: string | null;
  tenant_name: string;
  username_suggestion: string;
}

const AcceptInvitation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(true);

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{ checked: boolean; available: boolean; reason?: string }>({ checked: false, available: false });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadingDetails(false);
      return;
    }
    authService.getInvitationDetails(token)
      .then((data) => {
        setDetails(data);
        setUsername(data.username_suggestion);
      })
      .catch((err) => setLoadError(getErrorMessage(err, 'This invitation link is invalid or has expired.')))
      .finally(() => setLoadingDetails(false));
  }, [token]);

  useEffect(() => {
    if (!token || !username || username.length < 3) {
      setUsernameStatus({ checked: false, available: false });
      return;
    }
    const handle = setTimeout(() => {
      authService.checkInvitationUsername(token, username)
        .then((result) => setUsernameStatus({ checked: true, available: result.available, reason: result.reason }))
        .catch(() => setUsernameStatus({ checked: false, available: false }));
    }, 400);
    return () => clearTimeout(handle);
  }, [token, username]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (username.length < 3 || !/^[a-zA-Z0-9]+$/.test(username)) {
      setError('Username must be at least 3 alphanumeric characters');
      return;
    }
    if (usernameStatus.checked && !usernameStatus.available) {
      setError(usernameStatus.reason || 'That username is already taken');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await authService.acceptInvitation(token, username, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to set up your account. The link may have expired.'));
    } finally {
      setSubmitting(false);
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
        py: 4,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            p: 5,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 70,
                height: 70,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                mb: 2,
              }}
            >
              <PersonAddIcon sx={{ fontSize: 35, color: 'white' }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Welcome Aboard
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              Set your username and password to finish setting up your account
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !token || loadError ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {loadError || 'No invitation token found in this link. Ask an admin to resend it.'}
            </Alert>
          ) : success ? (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Your account is set up! Redirecting you to sign in...
            </Alert>
          ) : details && (
            <>
              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <BadgeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {details.first_name} {details.last_name}
                  </Typography>
                  <Chip label={details.employee_id} size="small" sx={{ fontFamily: 'monospace', ml: 'auto' }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, rowGap: 0.75 }}>
                  <DetailRow label="Company" value={details.tenant_name} />
                  <DetailRow label="Email" value={details.email} />
                  <DetailRow label="Department" value={details.department} />
                  <DetailRow label="Position" value={details.position} />
                  {details.designation && <DetailRow label="Designation" value={details.designation} />}
                  {details.seniority_level && <DetailRow label="Seniority" value={details.seniority_level} />}
                  {details.joining_date && <DetailRow label="Joining Date" value={details.joining_date} />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  These details were set by your admin. Contact them if anything needs to change.
                </Typography>
              </Paper>

              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  margin="normal"
                  size="medium"
                  helperText={usernameStatus.checked ? (usernameStatus.available ? 'Available' : (usernameStatus.reason || 'Already taken')) : 'At least 3 alphanumeric characters. You can also log in with your email.'}
                  error={usernameStatus.checked && !usernameStatus.available}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonAddIcon color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: usernameStatus.checked ? (
                        <InputAdornment position="end">
                          {usernameStatus.available ? <CheckCircleIcon color="success" fontSize="small" /> : <CancelIcon color="error" fontSize="small" />}
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  margin="normal"
                  size="medium"
                  helperText="At least 8 characters, with uppercase, lowercase, and a number"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  margin="normal"
                  size="medium"
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  size="large"
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                  }}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" /> : 'Finish Setup'}
                </Button>
              </form>
            </>
          )}

          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button
              component={RouterLink}
              to="/login"
              sx={{ textTransform: 'none', fontWeight: 600, color: '#667eea', '&:hover': { color: '#764ba2' } }}
            >
              Back to Sign In
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
  </Box>
);

export default AcceptInvitation;
