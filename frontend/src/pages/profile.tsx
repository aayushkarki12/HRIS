import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  MenuItem,
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { employeeService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const profileSchema = z.object({
  first_name: z.string().min(2, 'First name is required'),
  last_name: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().nullable(),
  department: z.string().min(2, 'Department is required'),
  position: z.string().min(2, 'Position is required'),
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

type ProfileFormData = z.infer<typeof profileSchema>;

const Profile: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch profile data
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      try {
        const data = await employeeService.getMyProfile();
        console.log('Profile data fetched:', data);
        return data;
      } catch (err) {
        console.error('Error fetching profile:', err);
        throw err;
      }
    },
    retry: 1,
  });

  // Initialize form
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      date_of_birth: '',
      gender: '',
      marital_status: '',
      address: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      emergency_contact_relation: '',
      bank_name: '',
      bank_account: '',
      bank_routing: '',
      social_security: '',
      skills: '',
      certifications: '',
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      console.log('Setting form values from profile:', profile);
      reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        department: profile.department || '',
        position: profile.position || '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        marital_status: profile.marital_status || '',
        address: profile.address || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
        emergency_contact_relation: profile.emergency_contact_relation || '',
        bank_name: profile.bank_name || '',
        bank_account: profile.bank_account || '',
        bank_routing: profile.bank_routing || '',
        social_security: profile.social_security || '',
        skills: profile.skills || '',
        certifications: profile.certifications || '',
      });
    }
  }, [profile, reset]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      console.log('Updating profile with data:', data);
      
      // Clean the data before sending
      const cleanedData: any = {};
      
      Object.keys(data).forEach(key => {
        const value = data[key as keyof ProfileFormData];
        // Convert empty strings to null, keep other values as is
        if (value === '') {
          cleanedData[key] = null;
        } else {
          cleanedData[key] = value;
        }
      });
      
      console.log('Cleaned data being sent:', cleanedData);
      const response = await employeeService.updateMyProfile(cleanedData);
      console.log('Update response:', response);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated successfully!');
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      setError('');
      setValidationErrors([]);
    },
    onError: (error: any) => {
      console.error('Update error full:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      
      // Handle validation errors properly
      let errorMessage = 'Failed to update profile';
      let errors: string[] = [];
      
      if (error.response?.data?.detail) {
        // FastAPI validation error format
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errors = error.response.data.detail.map((err: any) => {
            const field = err.loc?.join('.') || 'field';
            const msg = err.msg || 'Invalid value';
            return `${field}: ${msg}`;
          });
          errorMessage = errors.join(', ');
        } else if (typeof error.response.data.detail === 'object') {
          // If detail is an object with validation errors
          const detail = error.response.data.detail;
          if (detail.errors) {
            errors = Object.entries(detail.errors).map(([key, value]) => 
              `${key}: ${Array.isArray(value) ? value.join(', ') : value}`
            );
            errorMessage = errors.join(', ');
          } else {
            errorMessage = JSON.stringify(detail);
          }
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setValidationErrors(errors);
      setError(errorMessage);
      toast.error(errorMessage);
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    setError('');
    setSuccess('');
    setValidationErrors([]);
    updateProfileMutation.mutate(data);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
    setValidationErrors([]);
    if (profile) {
      reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        department: profile.department || '',
        position: profile.position || '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
        marital_status: profile.marital_status || '',
        address: profile.address || '',
        emergency_contact_name: profile.emergency_contact_name || '',
        emergency_contact_phone: profile.emergency_contact_phone || '',
        emergency_contact_relation: profile.emergency_contact_relation || '',
        bank_name: profile.bank_name || '',
        bank_account: profile.bank_account || '',
        bank_routing: profile.bank_routing || '',
        social_security: profile.social_security || '',
        skills: profile.skills || '',
        certifications: profile.certifications || '',
      });
    }
  };

  if (isLoading) {
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
            My Profile
          </Typography>
          <Typography variant="body2" color="textSecondary">
            View and manage your personal information
          </Typography>
        </Box>
        {!isEditing && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => setIsEditing(true)}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
              },
            }}
          >
            Edit Profile
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setValidationErrors([])}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validationErrors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Personal Information */}
          <Grid item xs={12} md={8}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Personal Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      {...register('first_name')}
                      error={!!errors.first_name}
                      helperText={errors.first_name?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Last Name"
                      {...register('last_name')}
                      error={!!errors.last_name}
                      helperText={errors.last_name?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      {...register('email')}
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      {...register('phone')}
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Date of Birth"
                      type="date"
                      {...register('date_of_birth')}
                      error={!!errors.date_of_birth}
                      helperText={errors.date_of_birth?.message}
                      disabled={!isEditing}
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Gender"
                      {...register('gender')}
                      error={!!errors.gender}
                      helperText={errors.gender?.message}
                      disabled={!isEditing}
                      size="small"
                      value={watch('gender') || ''}
                    >
                      <MenuItem value="">Select</MenuItem>
                      <MenuItem value="male">Male</MenuItem>
                      <MenuItem value="female">Female</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      select
                      label="Marital Status"
                      {...register('marital_status')}
                      error={!!errors.marital_status}
                      helperText={errors.marital_status?.message}
                      disabled={!isEditing}
                      size="small"
                      value={watch('marital_status') || ''}
                    >
                      <MenuItem value="">Select</MenuItem>
                      <MenuItem value="single">Single</MenuItem>
                      <MenuItem value="married">Married</MenuItem>
                      <MenuItem value="divorced">Divorced</MenuItem>
                      <MenuItem value="widowed">Widowed</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Address"
                      multiline
                      rows={2}
                      {...register('address')}
                      error={!!errors.address}
                      helperText={errors.address?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Work Information */}
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Work Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Department"
                      {...register('department')}
                      error={!!errors.department}
                      helperText={errors.department?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Position"
                      {...register('position')}
                      error={!!errors.position}
                      helperText={errors.position?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Skills"
                      {...register('skills')}
                      error={!!errors.skills}
                      helperText={errors.skills?.message}
                      disabled={!isEditing}
                      size="small"
                      placeholder="Python, React, AWS, ..."
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Certifications"
                      {...register('certifications')}
                      error={!!errors.certifications}
                      helperText={errors.certifications?.message}
                      disabled={!isEditing}
                      size="small"
                      placeholder="AWS Certified, Scrum Master, ..."
                      multiline
                      rows={2}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Emergency Contact */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Emergency Contact
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Contact Name"
                      {...register('emergency_contact_name')}
                      error={!!errors.emergency_contact_name}
                      helperText={errors.emergency_contact_name?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Phone"
                      {...register('emergency_contact_phone')}
                      error={!!errors.emergency_contact_phone}
                      helperText={errors.emergency_contact_phone?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Relation"
                      {...register('emergency_contact_relation')}
                      error={!!errors.emergency_contact_relation}
                      helperText={errors.emergency_contact_relation?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Banking Information */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Banking Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Bank Name"
                      {...register('bank_name')}
                      error={!!errors.bank_name}
                      helperText={errors.bank_name?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Account Number"
                      {...register('bank_account')}
                      error={!!errors.bank_account}
                      helperText={errors.bank_account?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Routing Number"
                      {...register('bank_routing')}
                      error={!!errors.bank_routing}
                      helperText={errors.bank_routing?.message}
                      disabled={!isEditing}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Social Security / Tax ID"
                      {...register('social_security')}
                      error={!!errors.social_security}
                      helperText={errors.social_security?.message}
                      disabled={!isEditing}
                      size="small"
                      type="password"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Actions */}
          {isEditing && (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting}
                  startIcon={<SaveIcon />}
                  sx={{
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
                  {isSubmitting ? <CircularProgress size={24} /> : 'Save Changes'}
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      </form>
    </Box>
  );
};

export default Profile;