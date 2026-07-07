import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, IconButton, Table,
  TableBody, TableCell, TableHead, TableRow, Divider, Alert, Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AddCircleOutlined as AddLineIcon,
  RemoveCircleOutlined as RemoveLineIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { accountingService, voucherService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';
import { VOUCHER_TYPES, voucherMeta, PARTY_LABELS, money } from './vouchers/voucherMeta';

interface LineForm {
  account_id: string;
  description: string;
  debit: string;
  credit: string;
  cost_center_id: string;
  tax_rate_id: string;
}

const emptyLine: LineForm = { account_id: '', description: '', debit: '', credit: '', cost_center_id: '', tax_rate_id: '' };

const VoucherForm: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const duplicateFrom = (location.state as any)?.duplicateFrom;

  const [voucherType, setVoucherType] = useState(duplicateFrom?.voucher_type ?? 'payment');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(duplicateFrom?.description ?? '');
  const [partyName, setPartyName] = useState(duplicateFrom?.party_name ?? '');
  const [paymentMethod, setPaymentMethod] = useState(duplicateFrom?.payment_method ?? 'bank');
  const [referenceNumber, setReferenceNumber] = useState(duplicateFrom?.reference_number ?? '');
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<LineForm[]>(
    duplicateFrom?.lines?.length
      ? duplicateFrom.lines.map((l: any) => ({
          account_id: String(l.account_id ?? ''), description: l.description ?? '',
          debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '',
          cost_center_id: l.cost_center_id ? String(l.cost_center_id) : '',
          tax_rate_id: l.tax_rate_id ? String(l.tax_rate_id) : '',
        }))
      : [{ ...emptyLine }, { ...emptyLine }]
  );
  const [error, setError] = useState('');

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => accountingService.getAccounts() });
  const { data: costCenters = [] } = useQuery({ queryKey: ['cost-centers'], queryFn: () => accountingService.getCostCenters({ is_active: true }) });
  const { data: taxRates = [] } = useQuery({ queryKey: ['tax-rates'], queryFn: () => accountingService.getTaxRates({ is_active: true }) });
  const activeAccounts = accounts?.filter((a: any) => a.is_active) || [];

  const meta = voucherMeta(voucherType);
  const partyMeta = PARTY_LABELS[voucherType];

  const createMutation = useMutation({
    mutationFn: (data: any) => voucherService.create(data),
    onSuccess: (voucher: any) => {
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
      toast.success(`${voucher.voucher_number} created`);
      navigate(`/vouchers/${voucher.id}`);
    },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to create voucher')),
  });

  const handleLineChange = (index: number, field: keyof LineForm, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'debit' && value) updated[index].credit = '';
    else if (field === 'credit' && value) updated[index].debit = '';
    setLines(updated);
  };

  const addLine = () => setLines([...lines, { ...emptyLine }]);
  const removeLine = (index: number) => { if (lines.length > 2) setLines(lines.filter((_, i) => i !== index)); };

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = () => {
    setError('');
    const entryLines = lines
      .filter((l) => l.account_id && (l.debit || l.credit))
      .map((l) => ({
        account_id: Number(l.account_id),
        description: l.description || null,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        cost_center_id: l.cost_center_id ? Number(l.cost_center_id) : null,
        tax_rate_id: l.tax_rate_id ? Number(l.tax_rate_id) : null,
      }));

    if (entryLines.length < 2) {
      setError('At least 2 accounting lines are required');
      return;
    }
    if (!description.trim()) {
      setError('Narration is required');
      return;
    }

    createMutation.mutate({
      voucher_type: voucherType,
      voucher_date: voucherDate,
      description,
      party_type: partyMeta.partyLabel.includes('Customer') ? 'customer' : partyMeta.partyLabel.includes('Vendor') ? 'vendor' : 'other',
      party_name: partyName || null,
      payment_method: partyMeta.showPaymentMethod ? paymentMethod : null,
      reference_number: referenceNumber || null,
      due_date: partyMeta.showDueDate && dueDate ? dueDate : null,
      remarks: remarks || null,
      lines: entryLines,
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isBalanced && !createMutation.isPending) handleSubmit();
      } else if (e.key === 'Escape') {
        navigate('/vouchers');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBalanced, createMutation.isPending, lines, voucherType, voucherDate, description, partyName, paymentMethod, referenceNumber, dueDate, remarks]);

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => navigate('/vouchers')} size="small"><BackIcon /></IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>New Voucher</Typography>
          <Typography variant="body2" color="text.secondary">Create a standardized accounting document</Typography>
        </Box>
      </Box>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {/* Header card - voucher type selector */}
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', mb: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Voucher Type</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {VOUCHER_TYPES.map((v) => (
              <Chip
                key={v.value}
                icon={<v.icon sx={{ fontSize: 16 }} />}
                label={v.short}
                onClick={() => setVoucherType(v.value)}
                sx={{
                  fontWeight: 600,
                  bgcolor: voucherType === v.value ? `${v.color}1A` : 'transparent',
                  color: voucherType === v.value ? v.color : 'text.secondary',
                  border: '1px solid',
                  borderColor: voucherType === v.value ? v.color : 'divider',
                }}
              />
            ))}
          </Box>
          <Alert severity="info" sx={{ mt: 2, borderRadius: 1.5 }}>{meta.hint}</Alert>
        </Paper>

        {/* Party + document info */}
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', mb: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Document Details</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mt: 1 }}>
            <TextField label="Voucher Date" type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label={partyMeta.partyLabel} value={partyName} onChange={(e) => setPartyName(e.target.value)} size="small" />
            <TextField label="Reference Number" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} size="small" placeholder="Optional" />
            {partyMeta.showPaymentMethod && (
              <TextField select label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} size="small">
                {['cash', 'bank', 'cheque', 'online'].map((m) => <MenuItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</MenuItem>)}
              </TextField>
            )}
            {partyMeta.showDueDate && (
              <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            )}
          </Box>
          <TextField
            fullWidth multiline rows={2} label="Narration" value={description}
            onChange={(e) => setDescription(e.target.value)} margin="normal" size="small"
            placeholder="Describe this transaction"
          />
        </Paper>

        {/* Accounting entries */}
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Accounting Entries</Typography>
            <Button size="small" startIcon={<AddLineIcon />} onClick={addLine}>Add Line</Button>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '24%' }}><strong>Ledger</strong></TableCell>
                  <TableCell sx={{ width: '16%' }}><strong>Description</strong></TableCell>
                  <TableCell sx={{ width: '13%' }}><strong>Cost Center</strong></TableCell>
                  <TableCell sx={{ width: '13%' }}><strong>Tax Code</strong></TableCell>
                  <TableCell sx={{ width: '12%' }} align="right"><strong>Debit</strong></TableCell>
                  <TableCell sx={{ width: '12%' }} align="right"><strong>Credit</strong></TableCell>
                  <TableCell sx={{ width: '5%' }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField select fullWidth size="small" value={line.account_id} onChange={(e) => handleLineChange(index, 'account_id', e.target.value)}>
                        <MenuItem value="">Select</MenuItem>
                        {activeAccounts.map((acc: any) => <MenuItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField fullWidth size="small" value={line.description} onChange={(e) => handleLineChange(index, 'description', e.target.value)} placeholder="Optional" />
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField select fullWidth size="small" value={line.cost_center_id} onChange={(e) => handleLineChange(index, 'cost_center_id', e.target.value)}>
                        <MenuItem value="">-</MenuItem>
                        {costCenters.map((cc: any) => <MenuItem key={cc.id} value={cc.id}>{cc.code}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField select fullWidth size="small" value={line.tax_rate_id} onChange={(e) => handleLineChange(index, 'tax_rate_id', e.target.value)}>
                        <MenuItem value="">-</MenuItem>
                        {taxRates.map((tr: any) => <MenuItem key={tr.id} value={tr.id}>{tr.name}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField fullWidth size="small" type="number" value={line.debit} onChange={(e) => handleLineChange(index, 'debit', e.target.value)} disabled={!!line.credit} />
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <TextField fullWidth size="small" type="number" value={line.credit} onChange={(e) => handleLineChange(index, 'credit', e.target.value)} disabled={!!line.debit} />
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <IconButton size="small" color="error" onClick={() => removeLine(index)} disabled={lines.length <= 2}>
                        <RemoveLineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>

        {/* Summary panel */}
        <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', mb: 2, position: 'sticky', bottom: 16, bgcolor: '#fff', zIndex: 1 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Debit</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#2563EB' }}>{money(totalDebit)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Credit</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#16A34A' }}>{money(totalCredit)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Difference</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: isBalanced ? '#16A34A' : '#DC2626' }}>
                  {money(Math.abs(totalDebit - totalCredit))}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained" size="large" startIcon={<SaveIcon />}
              disabled={!isBalanced || createMutation.isPending}
              onClick={handleSubmit}
            >
              {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
            </Button>
          </Box>
        </Paper>

        <TextField
          fullWidth multiline rows={2} label="Remarks (optional)" value={remarks}
          onChange={(e) => setRemarks(e.target.value)} size="small"
        />
      </motion.div>
    </Box>
  );
};

export default VoucherForm;
