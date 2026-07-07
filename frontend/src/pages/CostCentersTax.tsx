import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, MenuItem, IconButton, LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
} from '@mui/icons-material';
import { accountingService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const CostCentersTax: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccEditing, setCcEditing] = useState<any>(null);
  const [ccForm, setCcForm] = useState({ code: '', name: '', budget_amount: '' });
  const [ccError, setCcError] = useState('');

  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxEditing, setTaxEditing] = useState<any>(null);
  const [taxForm, setTaxForm] = useState({ name: '', tax_type: 'GST', rate: '' });
  const [taxError, setTaxError] = useState('');

  const { data: costCenters, isLoading: ccLoading } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: () => accountingService.getCostCenters(),
  });

  const { data: taxRates, isLoading: taxLoading } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: () => accountingService.getTaxRates(),
  });

  const ccCreateMutation = useMutation({
    mutationFn: (data: any) => ccEditing ? accountingService.updateCostCenter(ccEditing.id, data) : accountingService.createCostCenter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success(ccEditing ? 'Cost center updated' : 'Cost center created');
      closeCcModal();
    },
    onError: (e: any) => setCcError(getErrorMessage(e, 'Failed to save cost center')),
  });

  const ccDeactivateMutation = useMutation({
    mutationFn: (id: number) => accountingService.deactivateCostCenter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast.success('Cost center deactivated');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to deactivate cost center')),
  });

  const taxCreateMutation = useMutation({
    mutationFn: (data: any) => taxEditing ? accountingService.updateTaxRate(taxEditing.id, data) : accountingService.createTaxRate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
      toast.success(taxEditing ? 'Tax rate updated' : 'Tax rate created');
      closeTaxModal();
    },
    onError: (e: any) => setTaxError(getErrorMessage(e, 'Failed to save tax rate')),
  });

  const taxDeactivateMutation = useMutation({
    mutationFn: (id: number) => accountingService.deactivateTaxRate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-rates'] });
      toast.success('Tax rate deactivated');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to deactivate tax rate')),
  });

  const openCcModal = (cc?: any) => {
    setCcEditing(cc ?? null);
    setCcForm(cc ? { code: cc.code, name: cc.name, budget_amount: cc.budget_amount ?? '' } : { code: '', name: '', budget_amount: '' });
    setCcError('');
    setCcModalOpen(true);
  };
  const closeCcModal = () => { setCcModalOpen(false); setCcEditing(null); setCcError(''); };

  const openTaxModal = (tr?: any) => {
    setTaxEditing(tr ?? null);
    setTaxForm(tr ? { name: tr.name, tax_type: tr.tax_type, rate: tr.rate } : { name: '', tax_type: 'GST', rate: '' });
    setTaxError('');
    setTaxModalOpen(true);
  };
  const closeTaxModal = () => { setTaxModalOpen(false); setTaxEditing(null); setTaxError(''); };

  const submitCc = () => {
    setCcError('');
    ccCreateMutation.mutate({
      code: ccForm.code,
      name: ccForm.name,
      budget_amount: ccForm.budget_amount ? Number(ccForm.budget_amount) : null,
    });
  };

  const submitTax = () => {
    setTaxError('');
    taxCreateMutation.mutate({
      name: taxForm.name,
      tax_type: taxForm.tax_type,
      rate: Number(taxForm.rate),
    });
  };

  if (!isManager) {
    return <AccessDenied />;
  }

  if (ccLoading || taxLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>Cost Centers & Tax Rates</Typography>
        <Typography variant="body2" color="textSecondary">Tag transactions to departments/projects and to GST-style tax rates</Typography>
      </Box>

      {/* Cost Centers */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Cost Centers</Typography>
        {isAdmin && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openCcModal()}>
            New Cost Center
          </Button>
        )}
      </Box>
      <TableContainer component={Paper} sx={{ borderRadius: 2, mb: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Code</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell align="right"><strong>Budget</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {(costCenters ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No cost centers yet</Typography></TableCell></TableRow>
            ) : (
              costCenters.map((cc: any) => (
                <TableRow key={cc.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{cc.code}</TableCell>
                  <TableCell>{cc.name}</TableCell>
                  <TableCell align="right">{cc.budget_amount ? `Rs. ${cc.budget_amount.toLocaleString()}` : '-'}</TableCell>
                  <TableCell>
                    <Chip label={cc.is_active ? 'Active' : 'Inactive'} color={cc.is_active ? 'success' : 'default'} size="small" />
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openCcModal(cc)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                      {cc.is_active && (
                        <IconButton size="small" color="error" onClick={() => ccDeactivateMutation.mutate(cc.id)} title="Deactivate">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Tax Rates */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Tax Rates</Typography>
        {isAdmin && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openTaxModal()}>
            New Tax Rate
          </Button>
        )}
      </Box>
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell align="right"><strong>Rate</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {(taxRates ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography color="textSecondary">No tax rates yet</Typography></TableCell></TableRow>
            ) : (
              taxRates.map((tr: any) => (
                <TableRow key={tr.id} hover>
                  <TableCell>{tr.name}</TableCell>
                  <TableCell>{tr.tax_type}</TableCell>
                  <TableCell align="right">{tr.rate}%</TableCell>
                  <TableCell>
                    <Chip label={tr.is_active ? 'Active' : 'Inactive'} color={tr.is_active ? 'success' : 'default'} size="small" />
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openTaxModal(tr)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                      {tr.is_active && (
                        <IconButton size="small" color="error" onClick={() => taxDeactivateMutation.mutate(tr.id)} title="Deactivate">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Cost Center Dialog */}
      <Dialog open={ccModalOpen} onClose={closeCcModal} maxWidth="xs" fullWidth>
        <DialogTitle>{ccEditing ? 'Edit Cost Center' : 'New Cost Center'}</DialogTitle>
        <DialogContent>
          {ccError && <Alert severity="error" sx={{ mb: 2 }}>{ccError}</Alert>}
          <TextField fullWidth label="Code" value={ccForm.code} onChange={(e) => setCcForm({ ...ccForm, code: e.target.value })} margin="normal" size="small" placeholder="e.g. DEPT-SALES" />
          <TextField fullWidth label="Name" value={ccForm.name} onChange={(e) => setCcForm({ ...ccForm, name: e.target.value })} margin="normal" size="small" placeholder="e.g. Sales Department" />
          <TextField fullWidth label="Budget (optional)" type="number" value={ccForm.budget_amount} onChange={(e) => setCcForm({ ...ccForm, budget_amount: e.target.value })} margin="normal" size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCcModal}>Cancel</Button>
          <Button variant="contained" onClick={submitCc} disabled={!ccForm.code || !ccForm.name || ccCreateMutation.isPending}>
            {ccCreateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tax Rate Dialog */}
      <Dialog open={taxModalOpen} onClose={closeTaxModal} maxWidth="xs" fullWidth>
        <DialogTitle>{taxEditing ? 'Edit Tax Rate' : 'New Tax Rate'}</DialogTitle>
        <DialogContent>
          {taxError && <Alert severity="error" sx={{ mb: 2 }}>{taxError}</Alert>}
          <TextField fullWidth label="Name" value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })} margin="normal" size="small" placeholder="e.g. GST 18%" />
          <TextField select fullWidth label="Tax Type" value={taxForm.tax_type} onChange={(e) => setTaxForm({ ...taxForm, tax_type: e.target.value })} margin="normal" size="small">
            {['GST', 'CGST', 'SGST', 'IGST', 'VAT', 'other'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Rate (%)" type="number" value={taxForm.rate} onChange={(e) => setTaxForm({ ...taxForm, rate: e.target.value })} margin="normal" size="small" slotProps={{ htmlInput: { min: 0, max: 100, step: 0.01 } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTaxModal}>Cancel</Button>
          <Button variant="contained" onClick={submitTax} disabled={!taxForm.name || !taxForm.rate || taxCreateMutation.isPending}>
            {taxCreateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CostCentersTax;
