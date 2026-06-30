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
  Divider,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import EmailIcon from '@mui/icons-material/Email';
import BusinessIcon from '@mui/icons-material/Business';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import { authService } from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [tenantSubdomain, setTenantSubdomain] = useState('default');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(email.trim().toLowerCase(), tenantSubdomain.trim() || 'default');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
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
              {submitted ? (
                <MarkEmailReadIcon sx={{ fontSize: 35, color: 'white' }} />
              ) : (
                <EmailIcon sx={{ fontSize: 35, color: 'white' }} />
              )}
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
              Forgot Password
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
              {submitted ? "We've sent you a reset link" : "We'll email you a link to reset it"}
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {submitted ? (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              If an account with that email exists, a password reset link has been sent. Check your inbox (and spam folder) - the link expires in 1 hour.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Organization Subdomain"
                value={tenantSubdomain}
                onChange={(e) => setTenantSubdomain(e.target.value)}
                required
                margin="normal"
                size="medium"
                helperText="Same subdomain you use to log in (e.g. 'default')"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                margin="normal"
                size="medium"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading}
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
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Reset Link'}
              </Button>
            </form>
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

export default ForgotPassword;
