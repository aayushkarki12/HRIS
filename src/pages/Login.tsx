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
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Login expects username and password
      const result = await login(formData.username, formData.password);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (username: string, password: string) => {
    setFormData({ username, password });
    setLoading(true);
    setError('');

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
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
      <Container maxWidth="xs">
        <Fade in={true} timeout={500}>
          <Paper
            elevation={12}
            sx={{
              padding: 4,
              borderRadius: 3,
              background: 'white',
              maxWidth: '420px',
              margin: '0 auto',
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
                <Typography sx={{ fontSize: 28, color: 'white' }}>🏢</Typography>
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
                HRIS System
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Human Resource Information System
              </Typography>
            </Box>

            <Divider sx={{ marginBottom: 2.5 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, marginBottom: 0.5, textAlign: 'center' }}>
              Welcome Back!
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', marginBottom: 2.5 }}>
              Sign in to continue
            </Typography>

            {error && (
              <Alert 
                severity="error" 
                sx={{ marginBottom: 2, borderRadius: 1.5 }}
                onClose={() => setError('')}
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Username or Email"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                variant="outlined"
                autoFocus
                size="small"
                sx={{ marginBottom: 1.5 }}
              />
              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                variant="outlined"
                size="small"
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
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', marginTop: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Don't have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/register"
                  underline="hover"
                  sx={{
                    fontWeight: 600,
                    color: '#667eea',
                    '&:hover': {
                      color: '#764ba2',
                    },
                  }}
                >
                  Register here
                </Link>
              </Typography>
            </Box>


            <Box sx={{ textAlign: 'center', marginTop: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.7 }}>
                Secured with JWT
              </Typography>
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
};

export default Login;