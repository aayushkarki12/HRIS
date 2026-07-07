import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  CircularProgress,
  Alert,
  MenuItem,
  Avatar,
  IconButton,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Lock as LockIcon,
  CameraAlt as CameraIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  ContactPhone as EmergencyIcon,
  AccountBalance as BankIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { employeeService, userService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:8000';

const profileSchema = z.object({
  first_name: z.string().min(2, 'Required'),
  last_name: z.string().min(2, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional().nullable(),
  department: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  date_of_birth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  marital_status: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  emergency_contact_relation: z.string().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  bank_account: z.string().optional().nullable(),
  bank_routing: z.string().optional().nullable(),
  social_security: z.string().optional().nullable(),
  skills: z.string().optional().nullable(),
  certifications: z.string().optional().nullable(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  old_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm_password: z.string().min(1, 'Required'),
}).refine(d => d.new_password === d.confirm_password, { message: "Passwords don't match", path: ['confirm_password'] });
type PwdForm = z.infer<typeof passwordSchema>;

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.05 } }),
};

const SectionCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; index?: number }> = ({ title, icon, children, index = 0 }) => (
  <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden', bgcolor: '#fff' }}>
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#FAFAFA' }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '0.01em' }}>{title}</Typography>
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Box>
  </motion.div>
);

const FieldGrid: React.FC<{ children: React.ReactNode; cols?: number }> = ({ children, cols = 2 }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${cols}, 1fr)` }, gap: 2 }}>
    {children}
  </Box>
);

const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: employeeService.getMyProfile,
    enabled: !!user?.id,
    retry: 1,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '', department: '', position: '',
      date_of_birth: '', gender: '', marital_status: '', address: '',
      emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
      bank_name: '', bank_account: '', bank_routing: '', social_security: '',
      skills: '', certifications: '',
    },
  });

  const { register: regPwd, handleSubmit: handlePwdSubmit, reset: resetPwd, formState: { errors: pwdErrors, isSubmitting: pwdSubmitting } } = useForm<PwdForm>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name || '', last_name: profile.last_name || '',
        email: profile.email || '', phone: profile.phone || '',
        department: profile.department || '', position: profile.position || '',
        date_of_birth: profile.date_of_birth || '', gender: profile.gender || '',
        marital_status: profile.marital_status || '', address: profile.address || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
        emergency_contact_relation: profile.emergency_contact_relation || '',
        bank_name: profile.bank_name || '', bank_account: profile.bank_account || '',
        bank_routing: profile.bank_routing || '', social_security: profile.social_security || '',
        skills: profile.skills || '', certifications: profile.certifications || '',
      });
    }
  }, [profile, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: ProfileForm) => {
      const cleaned: any = {};
      Object.keys(data).forEach(k => { cleaned[k] = (data as any)[k] === '' ? null : (data as any)[k]; });
      return employeeService.updateMyProfile(cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile updated');
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to update profile'));
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => employeeService.uploadAvatar(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile photo updated');
      setAvatarPreview(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to upload photo'));
      setAvatarPreview(null);
    },
  });

  const pwdMutation = useMutation({
    mutationFn: (data: PwdForm) => {
      if (!user) throw new Error('Not logged in');
      return userService.changePassword(user.id, data.old_password, data.new_password);
    },
    onSuccess: async () => {
      toast.success('Password changed. Please log in again.');
      resetPwd();
      await logout();
      navigate('/login');
    },
    onError: (err: any) => {
      const msg = getErrorMessage(err, 'Failed to change password');
      setPwdError(msg);
      toast.error(msg);
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    avatarMutation.mutate(file);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) reset({
      first_name: profile.first_name || '', last_name: profile.last_name || '',
      email: profile.email || '', phone: profile.phone || '',
      department: profile.department || '', position: profile.position || '',
      date_of_birth: profile.date_of_birth || '', gender: profile.gender || '',
      marital_status: profile.marital_status || '', address: profile.address || '',
      emergency_contact_name: profile.emergency_contact_name || '',
      emergency_contact_phone: profile.emergency_contact_phone || '',
      emergency_contact_relation: profile.emergency_contact_relation || '',
      bank_name: profile.bank_name || '', bank_account: profile.bank_account || '',
      bank_routing: profile.bank_routing || '', social_security: profile.social_security || '',
      skills: profile.skills || '', certifications: profile.certifications || '',
    });
  };

  const avatarSrc = avatarPreview || (profile?.profile_picture ? `${API_BASE}${profile.profile_picture}` : undefined);
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : user?.username || '';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>My Profile</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Manage your personal information and account settings</Typography>
          </Box>
          {!isEditing ? (
            <Button variant="outlined" startIcon={<EditIcon sx={{ fontSize: 15 }} />} onClick={() => setIsEditing(true)} size="small" sx={{ fontWeight: 600 }}>
              Edit Profile
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<CancelIcon sx={{ fontSize: 15 }} />} onClick={handleCancel} size="small">Cancel</Button>
              <Button variant="contained" startIcon={<SaveIcon sx={{ fontSize: 15 }} />} onClick={handleSubmit(d => updateMutation.mutate(d))} size="small" disabled={isSubmitting || updateMutation.isPending} sx={{ fontWeight: 600 }}>
                {updateMutation.isPending ? <CircularProgress size={14} color="inherit" /> : 'Save Changes'}
              </Button>
            </Box>
          )}
        </Box>
      </motion.div>

      {/* Avatar card */}
      <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible">
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3, mb: 2.5, bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            {isLoading ? (
              <Skeleton variant="circular" width={80} height={80} />
            ) : (
              <Avatar src={avatarSrc} sx={{ width: 80, height: 80, fontSize: '1.5rem', fontWeight: 700, bgcolor: 'primary.main' }}>
                {!avatarSrc && initials}
              </Avatar>
            )}
            <Tooltip title="Upload photo">
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarMutation.isPending}
                sx={{
                  position: 'absolute', bottom: -4, right: -4,
                  bgcolor: '#fff', border: '1px solid', borderColor: 'divider',
                  width: 28, height: 28,
                  '&:hover': { bgcolor: 'primary.main', color: '#fff', borderColor: 'primary.main' },
                }}
              >
                {avatarMutation.isPending ? <CircularProgress size={12} /> : <CameraIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
          </Box>
          <Box sx={{ flex: 1 }}>
            {isLoading ? (
              <>
                <Skeleton width={160} height={24} />
                <Skeleton width={120} height={18} sx={{ mt: 0.5 }} />
              </>
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>{displayName}</Typography>
                <Typography variant="body2" color="text.secondary">{profile?.position} · {profile?.department}</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>Employee #{profile?.employee_id}</Typography>
              </>
            )}
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'flex-end', display: { xs: 'none', sm: 'block' } }}>
            Click the camera icon to change your photo
          </Typography>
        </Box>
      </motion.div>

      <form onSubmit={handleSubmit(d => updateMutation.mutate(d))}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Personal */}
          <SectionCard title="Personal Information" icon={<PersonIcon sx={{ fontSize: 16 }} />} index={2}>
            <FieldGrid>
              <TextField size="small" label="First Name" {...register('first_name')} error={!!errors.first_name} helperText={errors.first_name?.message} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Last Name" {...register('last_name')} error={!!errors.last_name} helperText={errors.last_name?.message} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Email" type="email" {...register('email')} error={!!errors.email} helperText={errors.email?.message} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Phone" {...register('phone')} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Date of Birth" type="date" {...register('date_of_birth')} disabled={!isEditing} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField size="small" select label="Gender" value={watch('gender') || ''} onChange={e => setValue('gender', e.target.value)} disabled={!isEditing} fullWidth>
                <MenuItem value="">Select</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
              <TextField size="small" select label="Marital Status" value={watch('marital_status') || ''} onChange={e => setValue('marital_status', e.target.value)} disabled={!isEditing} fullWidth>
                <MenuItem value="">Select</MenuItem>
                <MenuItem value="single">Single</MenuItem>
                <MenuItem value="married">Married</MenuItem>
                <MenuItem value="divorced">Divorced</MenuItem>
                <MenuItem value="widowed">Widowed</MenuItem>
              </TextField>
              <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
                <TextField size="small" label="Address" multiline rows={2} {...register('address')} disabled={!isEditing} fullWidth />
              </Box>
            </FieldGrid>
          </SectionCard>

          {/* Work */}
          <SectionCard title="Work Information" icon={<WorkIcon sx={{ fontSize: 16 }} />} index={3}>
            <FieldGrid>
              <TextField size="small" label="Department" {...register('department')} error={!!errors.department} helperText={errors.department?.message} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Job Title / Position" {...register('position')} error={!!errors.position} helperText={errors.position?.message} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Skills" multiline rows={2} placeholder="Python, React, AWS…" {...register('skills')} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Certifications" multiline rows={2} placeholder="AWS Certified, PMP…" {...register('certifications')} disabled={!isEditing} fullWidth />
            </FieldGrid>
          </SectionCard>

          {/* Emergency */}
          <SectionCard title="Emergency Contact" icon={<EmergencyIcon sx={{ fontSize: 16 }} />} index={4}>
            <FieldGrid cols={3}>
              <TextField size="small" label="Contact Name" {...register('emergency_contact_name')} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Phone" {...register('emergency_contact_phone')} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Relation" {...register('emergency_contact_relation')} disabled={!isEditing} fullWidth />
            </FieldGrid>
          </SectionCard>

          {/* Banking */}
          <SectionCard title="Banking Information" icon={<BankIcon sx={{ fontSize: 16 }} />} index={5}>
            <FieldGrid>
              <TextField size="small" label="Bank Name" {...register('bank_name')} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Account Number" {...register('bank_account')} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Routing Number" {...register('bank_routing')} disabled={!isEditing} fullWidth />
              <TextField size="small" label="Tax ID / SSN" type="password" {...register('social_security')} disabled={!isEditing} fullWidth />
            </FieldGrid>
          </SectionCard>
        </Box>
      </form>

      {/* Change Password */}
      <motion.div variants={fadeUp} custom={6} initial="hidden" animate="visible">
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden', bgcolor: '#fff', mt: 2.5 }}>
          <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#FAFAFA' }}>
            <Box sx={{ color: 'text.secondary', display: 'flex' }}><LockIcon sx={{ fontSize: 16 }} /></Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>Change Password</Typography>
          </Box>
          <Box sx={{ p: 3 }}>
            <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.8125rem' }}>
              Changing your password will sign you out of all devices.
            </Alert>
            {pwdError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPwdError('')}>{pwdError}</Alert>}
            <form onSubmit={handlePwdSubmit(d => { setPwdError(''); pwdMutation.mutate(d); })}>
              <FieldGrid cols={3}>
                <TextField size="small" label="Current Password" type="password" {...regPwd('old_password')} error={!!pwdErrors.old_password} helperText={pwdErrors.old_password?.message} fullWidth />
                <TextField size="small" label="New Password" type="password" {...regPwd('new_password')} error={!!pwdErrors.new_password} helperText={pwdErrors.new_password?.message || 'Min 8 characters'} fullWidth />
                <TextField size="small" label="Confirm Password" type="password" {...regPwd('confirm_password')} error={!!pwdErrors.confirm_password} helperText={pwdErrors.confirm_password?.message} fullWidth />
              </FieldGrid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button type="submit" variant="contained" size="small" disabled={pwdSubmitting || pwdMutation.isPending} startIcon={<LockIcon sx={{ fontSize: 15 }} />} sx={{ fontWeight: 600 }}>
                  {pwdMutation.isPending ? <CircularProgress size={14} color="inherit" /> : 'Change Password'}
                </Button>
              </Box>
            </form>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
};

export default Profile;
