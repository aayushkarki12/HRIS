import React, { useEffect, useState } from 'react';
import {
  Button,
  Typography,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import { authService, getErrorMessage } from '../services/api';

const ConfirmEmailChange: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No confirmation token found in this link.');
      setLoading(false);
      return;
    }
    authService.confirmEmailChange(token)
      .then(() => setSuccess(true))
      .catch((err) => setError(getErrorMessage(err, 'This confirmation link is invalid or has expired.')))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#F8FAFC',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '0 0 420px',
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

        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            bgcolor: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <CorporateFareIcon sx={{ color: '#fff', fontSize: 26 }} />
        </Box>
        <Typography variant="h4" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", color: '#fff', fontWeight: 700, mb: 1.5, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          HRIS System
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem', lineHeight: 1.6, mb: 4 }}>
          Human Resource Information System — manage employees, leaves, projects, and more in one place.
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 4 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 3 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CorporateFareIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>HRIS System</Typography>
          </Box>

          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: '12px',
              bgcolor: '#F1F5F9',
              mb: 2.5,
            }}
          >
            <MarkEmailReadIcon sx={{ fontSize: 24, color: 'primary.main' }} />
          </Box>

          <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em', mb: 0.5 }}>
            Confirm email change
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Confirming your new login email address
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : success ? (
            <Alert severity="success">
              Your login email has been updated. You can now sign in with your new address.
            </Alert>
          ) : (
            <Alert severity="error">{error}</Alert>
          )}

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button component={RouterLink} to="/login" size="small" sx={{ fontWeight: 600 }}>
              Back to Sign In
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ConfirmEmailChange;
