import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Description as FileIcon,
  Verified as VerifiedIcon,
  Pending as PendingIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { documentService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Documents: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: documentService.getMyDocuments,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      return documentService.upload(selectedFile, documentType, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully');
      setIsModalOpen(false);
      setSelectedFile(null);
      setDocumentType('');
      setDescription('');
      setError('');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to upload document';
      toast.error(errorMsg);
      setError(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: documentService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to delete document';
      toast.error(errorMsg);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: documentService.verify,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document verified successfully');
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to verify document';
      toast.error(errorMsg);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    setUploading(true);
    uploadMutation.mutate();
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleVerify = (id: number) => {
    verifyMutation.mutate(id);
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, any> = {
      passport: 'primary',
      id: 'secondary',
      resume: 'success',
      contract: 'warning',
      other: 'default',
    };
    return colors[type] || 'default';
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      passport: 'Passport',
      id: 'ID Card',
      resume: 'Resume/CV',
      contract: 'Contract',
      other: 'Other',
    };
    return labels[type] || type;
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
            My Documents
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Upload and manage your documents
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setIsModalOpen(true)}
          >
            Upload Document
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {documents && documents.length > 0 ? (
          documents.map((doc: any) => (
            <Grid item xs={12} sm={6} md={4} key={doc.id}>
              <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {doc.document_name}
                      </Typography>
                      <Chip
                        label={getDocumentTypeLabel(doc.document_type)}
                        color={getDocumentTypeColor(doc.document_type)}
                        size="small"
                      />
                      {doc.is_verified ? (
                        <Chip
                          icon={<VerifiedIcon />}
                          label="Verified"
                          color="success"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      ) : (
                        <Chip
                          icon={<PendingIcon />}
                          label="Pending"
                          color="warning"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                    <FileIcon color="action" sx={{ fontSize: 40 }} />
                  </Box>
                  {doc.description && (
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      {doc.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                    Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  {isAdmin && !doc.is_verified && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<VerifiedIcon />}
                      onClick={() => handleVerify(doc.id)}
                    >
                      Verify
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(doc.id)}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
              <Box sx={{ fontSize: 64, mb: 2 }}>📄</Box>
              <Typography variant="h6" sx={{ mb: 1 }}>No documents found</Typography>
              <Typography variant="body2" color="textSecondary">
                Upload your first document to get started
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Upload Dialog */}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            select
            label="Document Type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            margin="normal"
            size="small"
          >
            <MenuItem value="passport">Passport</MenuItem>
            <MenuItem value="id">ID Card</MenuItem>
            <MenuItem value="resume">Resume / CV</MenuItem>
            <MenuItem value="contract">Employment Contract</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            size="small"
            multiline
            rows={2}
          />
          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ mt: 2, py: 2 }}
          >
            {selectedFile ? selectedFile.name : 'Select File'}
            <input
              type="file"
              hidden
              onChange={handleFileChange}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || !documentType || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Documents;