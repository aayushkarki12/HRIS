import React, { useEffect, useRef, useState } from 'react';
import {
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Box,
  InputAdornment,
  IconButton,
  Chip,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LockIcon from '@mui/icons-material/Lock';
import BadgeIcon from '@mui/icons-material/Badge';
import PhoneIcon from '@mui/icons-material/Phone';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { authService, getErrorMessage } from '../services/api';
import { createRecaptchaVerifier, sendPhoneOtp, isFirebaseConfigured } from '../services/firebase';

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
  phone_suggestion?: string | null;
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

  // ---------- Phone verification (Firebase OTP) ----------
  // Required before Finish Setup is enabled - self-registration was removed,
  // so this is the only place a phone number gets collected/verified. See
  // HRIS_backend app/core/firebase.py and POST /auth/verify-phone.
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadingDetails(false);
      return;
    }
    authService.getInvitationDetails(token)
      .then((data) => {
        setDetails(data);
        setUsername(data.username_suggestion);
        if (data.phone_suggestion) setPhone(data.phone_suggestion);
      })
      .catch((err) => setLoadError(getErrorMessage(err, 'This invitation link is invalid or has expired.')))
      .finally(() => setLoadingDetails(false));
  }, [token]);

  const handleSendOtp = async () => {
    setPhoneError('');
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setPhoneError('Enter your phone number with country code, e.g. +15551234567');
      return;
    }
    setSendingOtp(true);
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = createRecaptchaVerifier('recaptcha-container');
      }
      confirmationResultRef.current = await sendPhoneOtp(phone, recaptchaVerifierRef.current);
      setOtpSent(true);
    } catch (err: any) {
      setPhoneError(err?.message || 'Failed to send verification code. Check the number and try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setPhoneError('');
    if (!confirmationResultRef.current) {
      setPhoneError('Send a code first');
      return;
    }
    setVerifyingOtp(true);
    try {
      const credential = await confirmationResultRef.current.confirm(otpCode);
      const idToken = await credential.user.getIdToken();
      await authService.verifyPhone(token, idToken);
      setPhoneVerified(true);
    } catch (err: any) {
      setPhoneError(getErrorMessage(err, 'Invalid or expired code. Please try again.'));
    } finally {
      setVerifyingOtp(false);
    }
  };

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
        bgcolor: '#F8FAFC',
      }}
    >
      {/* Left panel — branding */}
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
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>H</Typography>
        </Box>
        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 1.5, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          HRIS System
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9375rem', lineHeight: 1.6, mb: 4 }}>
          Human Resource Information System — manage employees, leaves, projects, and more in one place.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {['Multi-tenant architecture', 'Leave & attendance tracking', 'Project & resource management', 'Inventory tracking'].map((f) => (
            <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem' }}>{f}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right panel — form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, sm: 4 },
          py: 4,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 460 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 3 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.875rem' }}>H</Typography>
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
              bgcolor: '#EEF2FF',
              mb: 2.5,
            }}
          >
            <PersonAddIcon sx={{ fontSize: 24, color: 'primary.main' }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 0.5 }}>
            Welcome aboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set your username and password to finish setting up your account
          </Typography>

          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !token || loadError ? (
            <Alert severity="error">
              {loadError || 'No invitation token found in this link. Ask an admin to resend it.'}
            </Alert>
          ) : success ? (
            <Alert severity="success">
              Your account is set up! Redirecting you to sign in...
            </Alert>
          ) : details && (
            <>
              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: '#FFFFFF' }}>
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

              <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: '#FFFFFF' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Verify Phone Number</Typography>
                  {phoneVerified && <Chip icon={<CheckCircleIcon />} label="Verified" color="success" size="small" sx={{ ml: 'auto' }} />}
                </Box>

                {!isFirebaseConfigured() ? (
                  <Alert severity="warning">Phone verification isn't configured yet. Contact an admin.</Alert>
                ) : phoneVerified ? (
                  <Typography variant="body2" color="text.secondary">{phone} is verified.</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {phoneError && <Alert severity="error" onClose={() => setPhoneError('')}>{phoneError}</Alert>}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        label="Phone Number"
                        placeholder="+15551234567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        size="small"
                        disabled={otpSent}
                        helperText="Include your country code, e.g. +1 for the US"
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        onClick={handleSendOtp}
                        disabled={sendingOtp || otpSent}
                      >
                        {sendingOtp ? 'Sending…' : otpSent ? 'Code Sent' : 'Send Code'}
                      </Button>
                    </Box>
                    {otpSent && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          fullWidth
                          label="Verification Code"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          size="small"
                        />
                        <Button
                          variant="contained"
                          size="small"
                          sx={{ flexShrink: 0 }}
                          onClick={handleVerifyOtp}
                          disabled={verifyingOtp || !otpCode}
                        >
                          {verifyingOtp ? 'Verifying…' : 'Verify'}
                        </Button>
                      </Box>
                    )}
                    {otpSent && (
                      <Button size="small" onClick={() => { setOtpSent(false); setOtpCode(''); confirmationResultRef.current = null; }}>
                        Use a different number
                      </Button>
                    )}
                  </Box>
                )}
                <div id="recaptcha-container" />
              </Paper>

              {error && (
                <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    size="small"
                    autoFocus
                    helperText={usernameStatus.checked ? (usernameStatus.available ? 'Available' : (usernameStatus.reason || 'Already taken')) : 'At least 3 alphanumeric characters. You can also log in with your email.'}
                    error={usernameStatus.checked && !usernameStatus.available}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonAddIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
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
                    size="small"
                    autoComplete="new-password"
                    helperText="At least 8 characters, with uppercase, lowercase, and a number"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                              {showPassword ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
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
                    size="small"
                    autoComplete="new-password"
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  {!phoneVerified && isFirebaseConfigured() && (
                    <Typography variant="caption" color="text.secondary">
                      Verify your phone number above before finishing setup.
                    </Typography>
                  )}
                  <Button
                    fullWidth
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting || (!phoneVerified && isFirebaseConfigured())}
                    sx={{ mt: 0.5, py: 1.25, fontWeight: 600 }}
                  >
                    {submitting ? <CircularProgress size={20} color="inherit" /> : 'Finish Setup'}
                  </Button>
                </Box>
              </form>
            </>
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

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
  </Box>
);

export default AcceptInvitation;
