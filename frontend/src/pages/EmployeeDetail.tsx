import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Chip,
  Avatar,
  Alert,
  Divider,
  IconButton,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ContentCopy as CopyIcon,
  PersonOff as PersonOffIcon,
  CheckCircle as ActivateIcon,
  MailOutlined as InviteIcon,
  DeleteForever as DeleteForeverIcon,
  WorkHistory as JoinedIcon,
  TrendingUp as PromotionIcon,
  DeleteOutlined as DeleteEntryIcon,
  DeleteSweep as ClearHistoryIcon,
  Description as FileIcon,
  Verified as VerifiedIcon,
  Pending as PendingIcon,
  Upload as UploadIcon,
  Delete as DeleteDocIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Close as ClosePreviewIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { employeeService, rbacService, documentService, workLocationService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport', id: 'ID Card', resume: 'Resume / CV', contract: 'Employment Contract', other: 'Other',
};

// Mirrors HRIS_backend document.py::_CONTENT_TYPE_EXTENSIONS - what the
// server actually accepts. Kept here for the file input's `accept` filter
// and the upload dialog's helper text, not as validation (the backend is
// the real gate).
const ACCEPTED_DOCUMENT_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.zip';
const ACCEPTED_DOCUMENT_TYPES_LABEL = 'PDF, images (JPG/PNG/WEBP/GIF), Word, Excel, plain text, or ZIP';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

const NEW_DESIGNATION_SENTINEL = '__new__';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const today = () => new Date().toISOString().split('T')[0];

const SectionPaper: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', mb: 2.5 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
    {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{subtitle}</Typography>}
    {!subtitle && <Box sx={{ mb: 2 }} />}
    {children}
  </Paper>
);

const EmployeeDetail: React.FC = () => {
  const { id } = useParams();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const { isAdmin, user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const invalidateEmployee = () => {
    queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employee-history', employeeId] });
  };

  const { data: employee, isLoading, isError, error } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => employeeService.getById(employeeId),
    enabled: !!employeeId,
    retry: false,
  });

  const isOwnProfile = !!employee && employee.user_id === user?.id;

  const { data: departments = [] } = useQuery({
    queryKey: ['rbac-departments'],
    queryFn: () => rbacService.getDepartments(),
  });

  const { data: roles = [], refetch: refetchRoles } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => rbacService.getRoles(),
  });

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeService.getAll(),
    enabled: isAdmin,
  });

  const { data: seniorityLevels = [] } = useQuery({
    queryKey: ['rbac-seniority-levels'],
    queryFn: () => rbacService.getSeniorityLevels(),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['employee-history', employeeId],
    queryFn: () => employeeService.getHistory(employeeId),
    enabled: !!employeeId,
  });

  const [deleteHistoryTarget, setDeleteHistoryTarget] = useState<number | null>(null);
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);

  const deleteHistoryMutation = useMutation({
    mutationFn: (logId: number) => employeeService.deleteHistoryEntry(employeeId, logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-history', employeeId] });
      toast.success('History entry deleted');
      setDeleteHistoryTarget(null);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to delete history entry'));
      setDeleteHistoryTarget(null);
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => employeeService.clearHistory(employeeId),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['employee-history', employeeId] });
      toast.success(result?.message ?? 'Career history cleared');
      setClearHistoryConfirmOpen(false);
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to clear career history'));
      setClearHistoryConfirmOpen(false);
    },
  });

  // ============ Basic info ============
  const [basicForm, setBasicForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', department: '', position: '', joining_date: '',
  });
  const [creatingDesignation, setCreatingDesignation] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');

  useEffect(() => {
    if (employee) {
      setBasicForm({
        first_name: employee.first_name ?? '',
        last_name: employee.last_name ?? '',
        email: employee.email ?? '',
        phone: employee.phone ?? '',
        department: employee.department ?? '',
        position: employee.position ?? '',
        joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : '',
      });
    }
  }, [employee]);

  const createRoleMutation = useMutation({
    mutationFn: (name: string) => rbacService.createRole({ name, permission_keys: [] }),
    onSuccess: async (newRole: any) => {
      await refetchRoles();
      setBasicForm((f) => ({ ...f, position: newRole.name }));
      setCreatingDesignation(false);
      setNewDesignationName('');
      toast.success(`"${newRole.name}" created`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to create designation')),
  });

  const updateBasicMutation = useMutation({
    mutationFn: (data: any) => employeeService.update(employeeId, data),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Basic info updated');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update employee')),
  });

  // ============ Employment & promotion ============
  const [employmentForm, setEmploymentForm] = useState({
    seniority_level_id: '' as string | number,
    employment_type: 'full_time' as 'full_time' | 'probation' | 'contractor',
    effective_date: today(),
  });

  useEffect(() => {
    if (employee) {
      setEmploymentForm((f) => ({
        ...f,
        seniority_level_id: employee.seniority_level_id ?? '',
        employment_type: (employee.employment_type as 'full_time' | 'probation' | 'contractor') ?? 'full_time',
      }));
    }
  }, [employee]);

  const updateEmploymentMutation = useMutation({
    mutationFn: (data: any) => employeeService.update(employeeId, data),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Employment details saved - the change is recorded on their career history at the effective date given');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update employment details')),
  });

  // Reporting line + contract end date - kept out of the career-tracked
  // mutation above on purpose: that one only re-enables its Save button when
  // seniority/employment_type actually change (see employmentUnchanged), so
  // folding these fields in there would silently make them un-savable on
  // their own.
  const [reportingForm, setReportingForm] = useState({
    reports_to_employee_id: '' as string | number,
    contract_end_date: '',
  });

  useEffect(() => {
    if (employee) {
      setReportingForm({
        reports_to_employee_id: employee.reports_to_employee_id ?? '',
        contract_end_date: employee.contract_end_date ?? '',
      });
    }
  }, [employee]);

  const updateReportingMutation = useMutation({
    mutationFn: (data: any) => employeeService.update(employeeId, data),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Saved');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to save')),
  });

  // The backend only writes a career-history entry when seniority_level_id or
  // employment_type actually differs from the employee's current value -
  // effective_date has nothing to attach to on its own (it's not a column,
  // just the timestamp for that entry). Without this check, saving after
  // only touching the date silently no-ops while still showing success.
  const employmentUnchanged = useMemo(() => {
    if (!employee) return true;
    const currentSeniority = employee.seniority_level_id ?? null;
    const formSeniority = employmentForm.seniority_level_id === '' ? null : Number(employmentForm.seniority_level_id);
    const currentType = employee.employment_type ?? 'full_time';
    return formSeniority === currentSeniority && employmentForm.employment_type === currentType;
  }, [employee, employmentForm.seniority_level_id, employmentForm.employment_type]);

  // ============ Attendance settings ============
  // Fixed: assigned site + optional fixed clock time, soft-enforced.
  // Individual: flexible timing, freeform. Contractor: fully freeform,
  // including clocking in/out across a day boundary. See
  // app/api/v1/attendance.py for how each type is actually handled.
  const [attendanceForm, setAttendanceForm] = useState({
    attendance_type: 'individual' as 'fixed' | 'individual' | 'contractor',
    assigned_work_location_id: '' as string | number,
    fixed_clock_in_time: '',
    fixed_clock_out_time: '',
    shift_working_days: [] as string[],
    contract_hours_per_period: '' as string | number,
    contract_hours_period: '' as '' | 'day' | 'week' | 'month',
  });

  useEffect(() => {
    if (employee) {
      setAttendanceForm({
        attendance_type: (employee.attendance_type as 'fixed' | 'individual' | 'contractor') ?? 'individual',
        assigned_work_location_id: employee.assigned_work_location_id ?? '',
        fixed_clock_in_time: employee.fixed_clock_in_time ?? '',
        fixed_clock_out_time: employee.fixed_clock_out_time ?? '',
        shift_working_days: employee.shift_working_days ? employee.shift_working_days.split(',').map((d: string) => d.trim()) : [],
        contract_hours_per_period: employee.contract_hours_per_period ?? '',
        contract_hours_period: employee.contract_hours_period ?? '',
      });
    }
  }, [employee]);

  const { data: workLocations = [] } = useQuery({
    queryKey: ['work-locations'],
    queryFn: () => workLocationService.getAll(),
    enabled: isAdmin,
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: (data: any) => employeeService.update(employeeId, data),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Attendance settings saved');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to update attendance settings')),
  });

  // ============ Documents ============
  // Consolidated here from the old standalone /documents page - an admin/
  // documents.verify holder sees and can verify everyone's documents (and
  // can upload on this employee's behalf); anyone viewing their own profile
  // sees and can upload their own, same as before.
  const canViewAllDocs = isAdmin || hasPermission('documents.verify');
  const canSeeDocs = canViewAllDocs || isOwnProfile;
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ['documents', employeeId, canViewAllDocs],
    queryFn: () => (canViewAllDocs ? documentService.getAll(employeeId) : documentService.getMyDocuments()),
    enabled: !!employeeId && canSeeDocs,
  });

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docError, setDocError] = useState('');

  const closeDocModal = () => {
    setDocModalOpen(false);
    setDocFile(null); setDocName(''); setDocType(''); setDocDescription(''); setDocError('');
  };

  const uploadDocMutation = useMutation({
    mutationFn: () => {
      if (!docFile) throw new Error('No file selected');
      return documentService.upload(docFile, docType, docName || docFile.name, docDescription || undefined, canViewAllDocs ? employeeId : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', employeeId] });
      toast.success('Document uploaded');
      closeDocModal();
    },
    onError: (err: any) => setDocError(getErrorMessage(err, 'Failed to upload document')),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => documentService.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', employeeId] });
      toast.success('Document deleted');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to delete document')),
  });

  const verifyDocMutation = useMutation({
    mutationFn: (docId: number) => documentService.verify(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', employeeId] });
      toast.success('Document verified');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to verify document')),
  });

  // ---------- Document preview ----------
  // Images and PDFs render natively via an object URL. docx/xlsx are
  // rendered client-side (mammoth -> HTML, xlsx/sheetjs -> HTML table) since
  // documents are served through an authenticated endpoint, not a public
  // URL, so a public-URL-based viewer (Google Docs viewer etc.) can't be
  // used. Anything else (old .doc, .zip, plain text past a size we bother
  // rendering) just offers Download instead of a broken preview.
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewKind, setPreviewKind] = useState<'image' | 'pdf' | 'html' | 'text' | 'unsupported' | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');

  const closePreview = () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    setPreviewDoc(null);
    setPreviewObjectUrl(null);
    setPreviewContent('');
    setPreviewKind(null);
    setPreviewError('');
  };

  const openPreview = async (doc: any) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewKind(null);
    try {
      const blob = await documentService.download(doc.id);
      const fileType = doc.file_type || blob.type;

      if (fileType?.startsWith('image/') || fileType === 'application/pdf') {
        setPreviewObjectUrl(URL.createObjectURL(blob));
        setPreviewKind(fileType === 'application/pdf' ? 'pdf' : 'image');
      } else if (fileType === DOCX_MIME) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewContent(result.value);
        setPreviewKind('html');
      } else if (fileType && XLSX_MIMES.has(fileType)) {
        const XLSX = await import('xlsx');
        const arrayBuffer = await blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        setPreviewContent(XLSX.utils.sheet_to_html(firstSheet));
        setPreviewKind('html');
      } else if (fileType === 'text/plain') {
        setPreviewContent(await blob.text());
        setPreviewKind('text');
      } else {
        setPreviewKind('unsupported');
      }
    } catch (err: any) {
      setPreviewError(getErrorMessage(err, 'Failed to load document'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadDoc = async (doc: any) => {
    try {
      const blob = await documentService.download(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name || 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to download document'));
    }
  };

  // ============ Admin actions ============
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [permanentDeleteConfirmOpen, setPermanentDeleteConfirmOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const deactivateMutation = useMutation({
    mutationFn: () => employeeService.delete(employeeId),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Employee deactivated');
      setDeactivateConfirmOpen(false);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to deactivate employee')),
  });

  const activateMutation = useMutation({
    mutationFn: () => employeeService.activate(employeeId),
    onSuccess: () => {
      invalidateEmployee();
      toast.success('Employee reactivated - their login works again');
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to reactivate employee')),
  });

  const resendInviteMutation = useMutation({
    mutationFn: () => employeeService.resendInvite(employeeId),
    onSuccess: (result: any) => {
      invalidateEmployee();
      setInviteLink(result.invite_link);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'Failed to resend invite')),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => employeeService.permanentDelete(employeeId),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(result?.message ?? 'Employee permanently deleted');
      navigate('/employees');
    },
    onError: (err: any) => {
      toast.error(getErrorMessage(err, 'Failed to permanently delete employee'));
      setPermanentDeleteConfirmOpen(false);
    },
  });

  if (isLoading) {
    return (
      <Box>
        <Skeleton width={120} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={220} sx={{ mb: 2, borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (isError || !employee) {
    const status = (error as any)?.response?.status;
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/employees')} size="small" sx={{ mb: 2 }} color="inherit">
          Back to Employees
        </Button>
        <Alert severity={status === 403 ? 'warning' : 'error'}>
          {status === 403
            ? "You're not authorized to view this employee's details."
            : 'Employee not found.'}
        </Alert>
      </Box>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/employees')} size="small" sx={{ mb: 2 }} color="inherit">
          Back to Employees
        </Button>

        {/* Header */}
        <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 56, height: 56, fontSize: '1.25rem', fontWeight: 600, bgcolor: '#FFFFFF', color: '#334155', border: '2px solid #CBD5E1' }}>
              {employee.first_name?.[0]}{employee.last_name?.[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>
                {employee.first_name} {employee.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <span style={{ fontFamily: 'monospace' }}>{employee.employee_id}</span>
                {' · '}{employee.department}{' · '}{employee.position}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={employee.is_active ? 'Active' : 'Inactive'} color={employee.is_active ? 'success' : 'default'} sx={{ fontWeight: 500 }} />
              {employee.invite_status === 'invited' && <Chip label="Invited" color="warning" variant="outlined" />}
              {employee.invite_status === 'expired' && <Chip label="Expired" color="error" variant="outlined" />}
              {employee.invite_status === 'accepted' && <Chip label="Accepted" color="success" variant="outlined" />}
            </Box>
          </Box>
        </Paper>

        {/* Basic info */}
        <SectionPaper title="Basic Info" subtitle={!isAdmin ? 'View only.' : undefined}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField
              fullWidth size="small" label="First Name" disabled={!isAdmin}
              value={basicForm.first_name}
              onChange={(e) => setBasicForm({ ...basicForm, first_name: e.target.value })}
            />
            <TextField
              fullWidth size="small" label="Last Name" disabled={!isAdmin}
              value={basicForm.last_name}
              onChange={(e) => setBasicForm({ ...basicForm, last_name: e.target.value })}
            />
            <TextField
              fullWidth size="small" label="Email" type="email" sx={{ gridColumn: '1 / -1' }} disabled={!isAdmin}
              value={basicForm.email}
              onChange={(e) => setBasicForm({ ...basicForm, email: e.target.value })}
            />
            <TextField
              fullWidth size="small" label="Phone" sx={{ gridColumn: '1 / -1' }} disabled={!isAdmin}
              value={basicForm.phone}
              onChange={(e) => setBasicForm({ ...basicForm, phone: e.target.value })}
            />
            <TextField
              fullWidth select size="small" label="Department" disabled={!isAdmin}
              value={basicForm.department}
              onChange={(e) => setBasicForm({ ...basicForm, department: e.target.value })}
            >
              {basicForm.department && !(departments as any[]).some((d) => d.name === basicForm.department) && (
                <MenuItem value={basicForm.department}>{basicForm.department} (not in list)</MenuItem>
              )}
              {(departments as any[]).map((d) => (
                <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth size="small" label="Join Date" type="date" disabled={!isAdmin}
              value={basicForm.joining_date}
              onChange={(e) => setBasicForm({ ...basicForm, joining_date: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {isAdmin && creatingDesignation ? (
              <Box sx={{ display: 'flex', gap: 1, gridColumn: '1 / -1' }}>
                <TextField
                  fullWidth autoFocus size="small" label="New Position / Designation"
                  value={newDesignationName}
                  onChange={(e) => setNewDesignationName(e.target.value)}
                  placeholder="e.g. Senior Developer"
                />
                <Button
                  variant="contained" size="small"
                  disabled={!newDesignationName.trim() || createRoleMutation.isPending}
                  onClick={() => createRoleMutation.mutate(newDesignationName.trim())}
                >
                  Add
                </Button>
                <Button size="small" color="inherit" onClick={() => { setCreatingDesignation(false); setNewDesignationName(''); }}>
                  Cancel
                </Button>
              </Box>
            ) : (
              <TextField
                fullWidth select size="small" label="Position / Designation" sx={{ gridColumn: '1 / -1' }} disabled={!isAdmin}
                value={basicForm.position}
                onChange={(e) => {
                  if (e.target.value === NEW_DESIGNATION_SENTINEL) {
                    setCreatingDesignation(true);
                    return;
                  }
                  setBasicForm({ ...basicForm, position: e.target.value });
                }}
                helperText={isAdmin ? 'Updates their job title. To change what permissions their login has, use Users & Roles.' : undefined}
              >
                {basicForm.position && !(roles as any[]).some((r) => r.name === basicForm.position) && (
                  <MenuItem value={basicForm.position}>{basicForm.position} (not in list)</MenuItem>
                )}
                {(roles as any[]).map((r) => (
                  <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
                ))}
                {isAdmin && <MenuItem value={NEW_DESIGNATION_SENTINEL} sx={{ fontStyle: 'italic' }}>+ Create New…</MenuItem>}
              </TextField>
            )}
          </Box>
          {isAdmin && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                disabled={updateBasicMutation.isPending}
                onClick={() => updateBasicMutation.mutate(basicForm)}
              >
                {updateBasicMutation.isPending ? 'Saving…' : 'Save Basic Info'}
              </Button>
            </Box>
          )}
        </SectionPaper>

        {/* Employment & promotion */}
        <SectionPaper
          title="Employment & Promotion"
          subtitle={isAdmin
            ? 'Recording a change here also adds an entry to Career History below, timestamped at the Effective Date - this is how a promotion is done.'
            : 'View only.'}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField
              fullWidth select size="small" label="Seniority Level" disabled={!isAdmin}
              value={employmentForm.seniority_level_id === null ? '' : String(employmentForm.seniority_level_id)}
              onChange={(e) => setEmploymentForm({ ...employmentForm, seniority_level_id: e.target.value })}
              helperText={isAdmin ? 'Affects seniority-based access within the organization' : undefined}
            >
              <MenuItem value="">None</MenuItem>
              {(seniorityLevels as any[]).map((level) => (
                <MenuItem key={level.id} value={String(level.id)}>{level.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth select size="small" label="Employment Status" disabled={!isAdmin}
              value={employmentForm.employment_type}
              onChange={(e) => setEmploymentForm({ ...employmentForm, employment_type: e.target.value as 'full_time' | 'probation' | 'contractor' })}
              helperText={isAdmin ? 'Probation gets a reduced leave allocation; contractors get none' : undefined}
            >
              <MenuItem value="full_time">Full-time</MenuItem>
              <MenuItem value="probation">Probation</MenuItem>
              <MenuItem value="contractor">Contractor</MenuItem>
            </TextField>
            {isAdmin && (
              <TextField
                fullWidth size="small" label="Effective Date" type="date" sx={{ gridColumn: '1 / -1' }}
                value={employmentForm.effective_date}
                onChange={(e) => setEmploymentForm({ ...employmentForm, effective_date: e.target.value })}
                helperText="When this change takes effect - controls where it lands on the career history timeline, not just when it's saved"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
          </Box>
          {isAdmin && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, mt: 2 }}>
              {employmentUnchanged && (
                <Typography variant="caption" color="text.secondary">
                  Change Seniority Level or Employment Status to record a promotion at this date.
                </Typography>
              )}
              <Tooltip title={employmentUnchanged ? 'Nothing to record - Seniority Level and Employment Status are unchanged' : ''}>
                <span>
                  <Button
                    variant="contained"
                    disabled={updateEmploymentMutation.isPending || employmentUnchanged}
                    onClick={() => updateEmploymentMutation.mutate({
                      seniority_level_id: employmentForm.seniority_level_id === '' ? null : Number(employmentForm.seniority_level_id),
                      employment_type: employmentForm.employment_type,
                      effective_date: employmentForm.effective_date,
                    })}
                  >
                    {updateEmploymentMutation.isPending ? 'Saving…' : 'Save / Promote'}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
        </SectionPaper>

        {/* Reporting line + contract end date - separate save from Employment
            & Promotion above since neither is career-history-tracked. */}
        {isAdmin && (
          <SectionPaper title="Reporting & Contract" subtitle="Optional - reference info only, not enforced anywhere.">
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                fullWidth select size="small" label="Reports To"
                value={reportingForm.reports_to_employee_id === '' ? '' : String(reportingForm.reports_to_employee_id)}
                onChange={(e) => setReportingForm({ ...reportingForm, reports_to_employee_id: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {(allEmployees as any[]).filter((e) => e.id !== employeeId).map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>{e.first_name} {e.last_name}</MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth size="small" label="Contract End Date" type="date"
                value={reportingForm.contract_end_date}
                onChange={(e) => setReportingForm({ ...reportingForm, contract_end_date: e.target.value })}
                helperText="For fixed-term/contractor engagements"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                disabled={updateReportingMutation.isPending}
                onClick={() => updateReportingMutation.mutate({
                  reports_to_employee_id: reportingForm.reports_to_employee_id === '' ? null : Number(reportingForm.reports_to_employee_id),
                  contract_end_date: reportingForm.contract_end_date || null,
                })}
              >
                {updateReportingMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          </SectionPaper>
        )}

        {/* Attendance settings - admin only, controls clock-in/out rules
            enforced in app/api/v1/attendance.py. */}
        {isAdmin && (
          <SectionPaper
            title="Attendance Settings"
            subtitle="Fixed: assigned site and clock time, flagged if missed. Individual: flexible timing. Contractor: fully freeform, including clocking in/out overnight."
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                fullWidth select size="small" label="Attendance Type" sx={{ gridColumn: attendanceForm.attendance_type === 'fixed' ? undefined : '1 / -1' }}
                value={attendanceForm.attendance_type}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_type: e.target.value as 'fixed' | 'individual' | 'contractor' })}
              >
                <MenuItem value="fixed">Fixed (assigned site & time)</MenuItem>
                <MenuItem value="individual">Individual (flexible)</MenuItem>
                <MenuItem value="contractor">Contractor (freeform, cross-day)</MenuItem>
              </TextField>
              {attendanceForm.attendance_type === 'fixed' && (
                <>
                  <TextField
                    fullWidth select size="small" label="Assigned Site"
                    value={attendanceForm.assigned_work_location_id === null ? '' : String(attendanceForm.assigned_work_location_id)}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, assigned_work_location_id: e.target.value })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {(workLocations as any[]).map((loc) => (
                      <MenuItem key={loc.id} value={String(loc.id)}>{loc.is_office ? `${loc.name} (Office)` : loc.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth size="small" label="Fixed Clock-In Time" type="time"
                    value={attendanceForm.fixed_clock_in_time}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, fixed_clock_in_time: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    fullWidth size="small" label="Fixed Clock-Out Time" type="time"
                    value={attendanceForm.fixed_clock_out_time}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, fixed_clock_out_time: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Working Days (optional - leave empty for every day)
                    </Typography>
                    <ToggleButtonGroup
                      value={attendanceForm.shift_working_days}
                      onChange={(_, days: string[]) => setAttendanceForm({ ...attendanceForm, shift_working_days: days })}
                      size="small"
                    >
                      {WEEKDAYS.map((d) => (
                        <ToggleButton key={d} value={d} sx={{ px: 1.5, fontSize: '0.75rem' }}>{d}</ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                </>
              )}
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Or, for hours-based arrangements instead of fixed days (e.g. "30 hours/month")
                </Typography>
              </Box>
              <TextField
                fullWidth size="small" label="Contract Hours" type="number"
                value={attendanceForm.contract_hours_per_period}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, contract_hours_per_period: e.target.value })}
                slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
              />
              <TextField
                fullWidth select size="small" label="Per"
                value={attendanceForm.contract_hours_period}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, contract_hours_period: e.target.value as '' | 'day' | 'week' | 'month' })}
              >
                <MenuItem value="">-</MenuItem>
                <MenuItem value="day">Day</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="month">Month</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="contained"
                disabled={updateAttendanceMutation.isPending}
                onClick={() => updateAttendanceMutation.mutate({
                  attendance_type: attendanceForm.attendance_type,
                  assigned_work_location_id: attendanceForm.assigned_work_location_id === '' ? null : Number(attendanceForm.assigned_work_location_id),
                  fixed_clock_in_time: attendanceForm.fixed_clock_in_time || null,
                  fixed_clock_out_time: attendanceForm.fixed_clock_out_time || null,
                  shift_working_days: attendanceForm.shift_working_days.length > 0 ? attendanceForm.shift_working_days.join(',') : null,
                  contract_hours_per_period: attendanceForm.contract_hours_per_period === '' ? null : Number(attendanceForm.contract_hours_per_period),
                  contract_hours_period: attendanceForm.contract_hours_period || null,
                })}
              >
                {updateAttendanceMutation.isPending ? 'Saving…' : 'Save Attendance Settings'}
              </Button>
            </Box>
          </SectionPaper>
        )}

        {/* Documents - self-upload for your own profile, or admin/documents.verify
            can view, upload for, and verify anyone's. */}
        {canSeeDocs && (
          <SectionPaper title="Documents" subtitle={!canViewAllDocs ? 'Your uploaded documents.' : undefined}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button size="small" variant="contained" startIcon={<UploadIcon />} onClick={() => setDocModalOpen(true)}>
                Upload Document
              </Button>
            </Box>
            {docsLoading ? (
              <Skeleton variant="rectangular" height={100} />
            ) : documents.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No documents uploaded
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {documents.map((doc: any) => (
                  <Paper key={doc.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{doc.document_name}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip label={DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type} size="small" />
                          {doc.is_verified ? (
                            <Chip icon={<VerifiedIcon />} label="Verified" color="success" size="small" />
                          ) : (
                            <Chip icon={<PendingIcon />} label="Pending" color="warning" size="small" />
                          )}
                        </Box>
                        {doc.description && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {doc.description}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Uploaded {new Date(doc.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <FileIcon color="action" sx={{ fontSize: 28, flexShrink: 0 }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                      <Button size="small" startIcon={<ViewIcon />} onClick={() => openPreview(doc)}>
                        View
                      </Button>
                      <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadDoc(doc)}>
                        Download
                      </Button>
                      {canViewAllDocs && !doc.is_verified && (
                        <Button size="small" color="success" startIcon={<VerifiedIcon />} onClick={() => verifyDocMutation.mutate(doc.id)}>
                          Verify
                        </Button>
                      )}
                      <Button size="small" color="error" startIcon={<DeleteDocIcon />} onClick={() => deleteDocMutation.mutate(doc.id)}>
                        Delete
                      </Button>
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </SectionPaper>
        )}

        {/* Document preview dialog */}
        <Dialog open={!!previewDoc} onClose={closePreview} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }} noWrap component="span">{previewDoc?.document_name}</Box>
            <IconButton size="small" onClick={closePreview}><ClosePreviewIcon fontSize="small" /></IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ minHeight: 300 }}>
            {previewLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><Skeleton variant="rectangular" width="100%" height={240} /></Box>
            ) : previewError ? (
              <Alert severity="error">{previewError}</Alert>
            ) : previewKind === 'image' && previewObjectUrl ? (
              <Box component="img" src={previewObjectUrl} alt={previewDoc?.document_name} sx={{ maxWidth: '100%', display: 'block', mx: 'auto' }} />
            ) : previewKind === 'pdf' && previewObjectUrl ? (
              <Box component="iframe" src={previewObjectUrl} title={previewDoc?.document_name} sx={{ width: '100%', height: '70vh', border: 0 }} />
            ) : previewKind === 'html' ? (
              <Box sx={{ overflowX: 'auto', '& table': { borderCollapse: 'collapse', width: '100%' }, '& td, & th': { border: '1px solid', borderColor: 'divider', p: 0.75, fontSize: '0.8125rem' } }}
                dangerouslySetInnerHTML={{ __html: previewContent }} />
            ) : previewKind === 'text' ? (
              <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.8125rem', m: 0 }}>{previewContent}</Box>
            ) : previewKind === 'unsupported' ? (
              <Alert severity="info">Preview not available for this file type - download to view.</Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            {previewDoc && (
              <Button startIcon={<DownloadIcon />} onClick={() => downloadDoc(previewDoc)}>Download</Button>
            )}
            <Button onClick={closePreview}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Career history */}
        <SectionPaper title="Career History">
          {historyLoading ? (
            <Skeleton variant="rectangular" height={120} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {isAdmin && history.some((e) => e.id != null) && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                  <Button
                    size="small" color="error" startIcon={<ClearHistoryIcon />}
                    onClick={() => setClearHistoryConfirmOpen(true)}
                  >
                    Clear All History
                  </Button>
                </Box>
              )}
              {[...history].reverse().map((entry, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1.5, position: 'relative', pb: i === history.length - 1 ? 0 : 3 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: entry.action === 'joined' ? '#F1F5F9' : '#F0FDF4', flexShrink: 0,
                    }}>
                      {entry.action === 'joined'
                        ? <JoinedIcon sx={{ fontSize: 16, color: '#334155' }} />
                        : <PromotionIcon sx={{ fontSize: 16, color: '#16A34A' }} />}
                    </Box>
                    {i !== history.length - 1 && <Box sx={{ width: '2px', flex: 1, bgcolor: 'divider', my: 0.5 }} />}
                  </Box>
                  <Box sx={{ pb: 1, flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.details}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </Typography>
                    </Box>
                    {isAdmin && entry.id != null && (
                      <Tooltip title="Delete this entry">
                        <IconButton size="small" onClick={() => setDeleteHistoryTarget(entry.id!)}>
                          <DeleteEntryIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              ))}
              {history.length === 0 && (
                <Typography variant="body2" color="text.secondary">No history recorded yet.</Typography>
              )}
            </Box>
          )}
        </SectionPaper>

        {/* Danger zone / admin actions */}
        {isAdmin && (
          <SectionPaper title="Danger Zone">
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(employee.invite_status === 'invited' || employee.invite_status === 'expired') && (
                <Tooltip title="Copy a fresh invite link">
                  <Button
                    variant="outlined" color="info" size="small" startIcon={<InviteIcon />}
                    disabled={resendInviteMutation.isPending}
                    onClick={() => resendInviteMutation.mutate()}
                  >
                    Resend Invite
                  </Button>
                </Tooltip>
              )}
              {employee.is_active ? (
                <Button
                  variant="outlined" color="error" size="small" startIcon={<PersonOffIcon />}
                  onClick={() => setDeactivateConfirmOpen(true)}
                >
                  Deactivate
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined" color="success" size="small" startIcon={<ActivateIcon />}
                    disabled={activateMutation.isPending}
                    onClick={() => activateMutation.mutate()}
                  >
                    Reactivate
                  </Button>
                  <Button
                    variant="outlined" color="error" size="small" startIcon={<DeleteForeverIcon />}
                    onClick={() => setPermanentDeleteConfirmOpen(true)}
                  >
                    Delete Permanently
                  </Button>
                </>
              )}
            </Box>
          </SectionPaper>
        )}

        {/* Deactivate confirmation */}
        <Dialog open={deactivateConfirmOpen} onClose={() => setDeactivateConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Deactivate Employee</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Are you sure you want to deactivate <strong>{employee.first_name} {employee.last_name}</strong>?
              Their login will be blocked immediately - you can reactivate it later from this page.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeactivateConfirmOpen(false)} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate()}
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Permanent delete confirmation */}
        <Dialog open={permanentDeleteConfirmOpen} onClose={() => setPermanentDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Delete Permanently</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>This cannot be undone.</Alert>
            <Typography variant="body2" color="text.secondary">
              Permanently delete <strong>{employee.first_name} {employee.last_name}</strong> and their login?
              Their timesheets, leave, attendance, and assignments will be deleted too. If they have related
              records elsewhere (approvals, timesheets, etc.) this will be rejected - deactivate them
              instead in that case.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPermanentDeleteConfirmOpen(false)} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={permanentDeleteMutation.isPending}
              onClick={() => permanentDeleteMutation.mutate()}
            >
              {permanentDeleteMutation.isPending ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Invite link result */}
        <Dialog open={!!inviteLink} onClose={() => setInviteLink(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Invite Link</DialogTitle>
          <DialogContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              Send this invite link to the new employee - it lets them see their details and set their own
              username and password. It won't be shown again.
            </Alert>
            <TextField
              fullWidth
              value={inviteLink ?? ''}
              size="small"
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <IconButton
                      size="small"
                      onClick={() => { if (inviteLink) { navigator.clipboard.writeText(inviteLink); toast.success('Copied'); } }}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  ),
                },
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInviteLink(null)} variant="contained">Done</Button>
          </DialogActions>
        </Dialog>

        {/* Delete single history entry confirmation */}
        <Dialog open={deleteHistoryTarget !== null} onClose={() => setDeleteHistoryTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Delete History Entry</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Delete this career history entry? This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteHistoryTarget(null)} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={deleteHistoryMutation.isPending}
              onClick={() => deleteHistoryTarget !== null && deleteHistoryMutation.mutate(deleteHistoryTarget)}
            >
              {deleteHistoryMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Clear entire history confirmation */}
        <Dialog open={clearHistoryConfirmOpen} onClose={() => setClearHistoryConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>Clear All Career History</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>This cannot be undone.</Alert>
            <Typography variant="body2" color="text.secondary">
              Delete every recorded career history entry for <strong>{employee.first_name} {employee.last_name}</strong>?
              Their "Joined" entry stays, since it isn't part of this history log.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setClearHistoryConfirmOpen(false)} color="inherit">Cancel</Button>
            <Button
              variant="contained" color="error"
              disabled={clearHistoryMutation.isPending}
              onClick={() => clearHistoryMutation.mutate()}
            >
              {clearHistoryMutation.isPending ? 'Clearing…' : 'Clear All'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={docModalOpen} onClose={closeDocModal} maxWidth="sm" fullWidth>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogContent>
            {docError && <Alert severity="error" sx={{ mb: 2 }}>{docError}</Alert>}
            <TextField
              fullWidth label="Document Name" value={docName} onChange={(e) => setDocName(e.target.value)}
              margin="normal" size="small" placeholder="e.g. Passport, Employment Contract"
            />
            <TextField
              fullWidth select label="Document Type" value={docType} onChange={(e) => setDocType(e.target.value)}
              margin="normal" size="small"
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth label="Description" value={docDescription} onChange={(e) => setDocDescription(e.target.value)}
              margin="normal" size="small" multiline rows={2}
            />
            <Button variant="outlined" component="label" fullWidth sx={{ mt: 2, py: 2 }}>
              {docFile ? docFile.name : 'Select File'}
              <input type="file" hidden accept={ACCEPTED_DOCUMENT_TYPES} onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              Accepted: {ACCEPTED_DOCUMENT_TYPES_LABEL}.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDocModal} color="inherit">Cancel</Button>
            <Button
              variant="contained"
              onClick={() => uploadDocMutation.mutate()}
              disabled={!docFile || !docType || !docName.trim() || uploadDocMutation.isPending}
            >
              {uploadDocMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogActions>
        </Dialog>

        <Divider sx={{ my: 2 }} />
      </Box>
    </motion.div>
  );
};

export default EmployeeDetail;
