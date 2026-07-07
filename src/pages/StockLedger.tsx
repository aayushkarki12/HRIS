import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, MenuItem, FormControlLabel, Checkbox,
} from '@mui/material';
import {
  ArrowDownward as InIcon, ArrowUpward as OutIcon, SwapHoriz as TransferIcon,
  Inventory2 as InventoryIcon, WarningAmber as WarningIcon, ErrorOutlined as OutOfStockIcon,
  AttachMoney as ValueIcon,
} from '@mui/icons-material';
import { inventoryService, accountingService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const money = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateTime = (d: string) => new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const MOVEMENT_META: Record<string, { label: string; color: string }> = {
  opening: { label: 'Opening', color: '#64748B' },
  purchase: { label: 'Stock In', color: '#16A34A' },
  sale: { label: 'Sale', color: '#DC2626' },
  adjustment: { label: 'Adjustment', color: '#D97706' },
  damaged: { label: 'Damaged', color: '#DC2626' },
  transfer_in: { label: 'Transfer In', color: '#2563EB' },
  transfer_out: { label: 'Transfer Out', color: '#7C3AED' },
};

type DialogMode = 'in' | 'out' | 'transfer' | null;

const StockLedger: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState('');

  const { data: dashboard } = useQuery({ queryKey: ['inventory-dashboard'], queryFn: () => inventoryService.getDashboard(), enabled: isManager });
  const { data: movements = [], isLoading } = useQuery({ queryKey: ['stock-movements'], queryFn: () => inventoryService.getMovements({ limit: 100 }), enabled: isManager });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: () => inventoryService.getItems({ is_active: true }), enabled: isManager });
  const { data: warehouses = [] } = useQuery({ queryKey: ['inventory-setup', 'warehouses'], queryFn: () => inventoryService.getWarehouses({ is_active: true }), enabled: isManager });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountingService.getAccounts(), enabled: isManager });

  const itemById = (id: number) => items.find((i: any) => i.id === id);
  const warehouseById = (id: number) => warehouses.find((w: any) => w.id === id);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  const stockInMutation = useMutation({
    mutationFn: () => inventoryService.stockIn({
      item_id: Number(form.item_id), warehouse_id: Number(form.warehouse_id),
      quantity: Number(form.quantity), unit_cost: Number(form.unit_cost),
      reference_type: 'purchase', reference_number: form.reference_number || null,
      notes: form.notes || null, post_voucher: !!form.post_voucher,
    }, form.post_voucher ? Number(form.contra_account_id) : undefined),
    onSuccess: () => { toast.success('Stock received'); invalidate(); closeDialog(); },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to record stock in')),
  });

  const stockOutMutation = useMutation({
    mutationFn: () => inventoryService.stockOut({
      item_id: Number(form.item_id), warehouse_id: Number(form.warehouse_id),
      quantity: Number(form.quantity), reference_type: form.reference_type || 'sale',
      reference_number: form.reference_number || null, notes: form.notes || null,
      post_voucher: !!form.post_voucher,
    }, form.post_voucher ? Number(form.contra_account_id) : undefined),
    onSuccess: () => { toast.success('Stock issued'); invalidate(); closeDialog(); },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to record stock out')),
  });

  const transferMutation = useMutation({
    mutationFn: () => inventoryService.transfer({
      item_id: Number(form.item_id), from_warehouse_id: Number(form.from_warehouse_id),
      to_warehouse_id: Number(form.to_warehouse_id), quantity: Number(form.quantity),
      notes: form.notes || null,
    }),
    onSuccess: () => { toast.success('Transfer completed'); invalidate(); closeDialog(); },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to transfer stock')),
  });

  const openDialog = (mode: DialogMode) => { setDialogMode(mode); setForm({}); setError(''); };
  const closeDialog = () => { setDialogMode(null); setForm({}); setError(''); };

  const handleSubmit = () => {
    setError('');
    if (dialogMode === 'in') stockInMutation.mutate();
    else if (dialogMode === 'out') stockOutMutation.mutate();
    else if (dialogMode === 'transfer') transferMutation.mutate();
  };

  const isPending = stockInMutation.isPending || stockOutMutation.isPending || transferMutation.isPending;

  if (!isManager) return <AccessDenied />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Stock Ledger</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Every stock movement across all warehouses, weighted-average costed
          </Typography>
        </Box>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" color="success" startIcon={<InIcon />} onClick={() => openDialog('in')}>Stock In</Button>
            <Button variant="outlined" color="error" startIcon={<OutIcon />} onClick={() => openDialog('out')}>Stock Out</Button>
            <Button variant="outlined" startIcon={<TransferIcon />} onClick={() => openDialog('transfer')}>Transfer</Button>
          </Box>
        )}
      </Box>

      {dashboard && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <InventoryIcon sx={{ fontSize: 18, color: '#4F46E5' }} />
              <Typography variant="caption" color="text.secondary">Total Items</Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{dashboard.total_items}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <ValueIcon sx={{ fontSize: 18, color: '#16A34A' }} />
              <Typography variant="caption" color="text.secondary">Stock Value</Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{money(dashboard.total_stock_value)}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: dashboard.low_stock_count > 0 ? '#FFFBEB' : undefined }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <WarningIcon sx={{ fontSize: 18, color: '#D97706' }} />
              <Typography variant="caption" color="text.secondary">Low Stock</Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#D97706' }}>{dashboard.low_stock_count}</Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: dashboard.out_of_stock_count > 0 ? '#FEF2F2' : undefined }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <OutOfStockIcon sx={{ fontSize: 18, color: '#DC2626' }} />
              <Typography variant="caption" color="text.secondary">Out of Stock</Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#DC2626' }}>{dashboard.out_of_stock_count}</Typography>
          </Paper>
        </Box>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Item</strong></TableCell>
                <TableCell><strong>Warehouse</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell align="right"><strong>Qty</strong></TableCell>
                <TableCell align="right"><strong>Unit Cost</strong></TableCell>
                <TableCell align="right"><strong>Balance</strong></TableCell>
                <TableCell><strong>Notes</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No stock movements yet</Typography></TableCell></TableRow>
              ) : movements.map((mv: any) => {
                const meta = MOVEMENT_META[mv.movement_type] ?? { label: mv.movement_type, color: '#64748B' };
                const item = itemById(mv.item_id);
                const warehouse = warehouseById(mv.warehouse_id);
                const isOut = ['sale', 'transfer_out', 'adjustment', 'damaged'].includes(mv.movement_type);
                return (
                  <TableRow key={mv.id} hover>
                    <TableCell>{fmtDateTime(mv.movement_date)}</TableCell>
                    <TableCell>{item ? `${item.sku} - ${item.name}` : `#${mv.item_id}`}</TableCell>
                    <TableCell>{warehouse?.name ?? `#${mv.warehouse_id}`}</TableCell>
                    <TableCell><Chip label={meta.label} size="small" sx={{ bgcolor: `${meta.color}1A`, color: meta.color, fontWeight: 700 }} /></TableCell>
                    <TableCell align="right" sx={{ color: isOut ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                      {isOut ? '-' : '+'}{mv.quantity}
                    </TableCell>
                    <TableCell align="right">{money(mv.unit_cost)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{mv.running_quantity}</TableCell>
                    <TableCell>{mv.notes || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Stock In */}
      <Dialog open={dialogMode === 'in'} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Stock In</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField select fullWidth label="Item" value={form.item_id ?? ''} onChange={(e) => setForm({ ...form, item_id: e.target.value })} margin="normal" size="small">
            {items.map((i: any) => <MenuItem key={i.id} value={i.id}>{i.sku} - {i.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Warehouse" value={form.warehouse_id ?? ''} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} margin="normal" size="small">
            {warehouses.map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Quantity" type="number" value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value })} margin="normal" size="small" />
            <TextField label="Unit Cost" type="number" value={form.unit_cost ?? ''} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} margin="normal" size="small" />
          </Box>
          <TextField fullWidth label="Reference Number (optional)" value={form.reference_number ?? ''} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} margin="normal" size="small" />
          <FormControlLabel
            control={<Checkbox checked={!!form.post_voucher} onChange={(e) => setForm({ ...form, post_voucher: e.target.checked })} />}
            label="Post accounting voucher"
          />
          {form.post_voucher && (
            <TextField select fullWidth label="Contra Account (e.g. Accounts Payable)" value={form.contra_account_id ?? ''} onChange={(e) => setForm({ ...form, contra_account_id: e.target.value })} margin="normal" size="small">
              {accounts.filter((a: any) => a.is_active).map((a: any) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
            </TextField>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.item_id || !form.warehouse_id || !form.quantity || isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Stock Out */}
      <Dialog open={dialogMode === 'out'} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Stock Out</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField select fullWidth label="Item" value={form.item_id ?? ''} onChange={(e) => setForm({ ...form, item_id: e.target.value })} margin="normal" size="small">
            {items.map((i: any) => <MenuItem key={i.id} value={i.id}>{i.sku} - {i.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Warehouse" value={form.warehouse_id ?? ''} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} margin="normal" size="small">
            {warehouses.map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="Reason" value={form.reference_type ?? 'sale'} onChange={(e) => setForm({ ...form, reference_type: e.target.value })} margin="normal" size="small">
            <MenuItem value="sale">Sale</MenuItem>
            <MenuItem value="adjustment">Adjustment</MenuItem>
            <MenuItem value="damaged">Damaged</MenuItem>
          </TextField>
          <TextField fullWidth label="Quantity" type="number" value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value })} margin="normal" size="small" />
          <TextField fullWidth label="Reference Number (optional)" value={form.reference_number ?? ''} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} margin="normal" size="small" />
          <FormControlLabel
            control={<Checkbox checked={!!form.post_voucher} onChange={(e) => setForm({ ...form, post_voucher: e.target.checked })} />}
            label="Post accounting voucher"
          />
          {form.post_voucher && form.reference_type !== 'sale' && (
            <TextField select fullWidth label="Contra Account" value={form.contra_account_id ?? ''} onChange={(e) => setForm({ ...form, contra_account_id: e.target.value })} margin="normal" size="small">
              {accounts.filter((a: any) => a.is_active).map((a: any) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
            </TextField>
          )}
          {form.post_voucher && form.reference_type === 'sale' && (
            <Alert severity="info" sx={{ mt: 1 }}>Uses the item's configured COGS and Inventory accounts automatically.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleSubmit} disabled={!form.item_id || !form.warehouse_id || !form.quantity || isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer */}
      <Dialog open={dialogMode === 'transfer'} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Transfer Stock</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField select fullWidth label="Item" value={form.item_id ?? ''} onChange={(e) => setForm({ ...form, item_id: e.target.value })} margin="normal" size="small">
            {items.map((i: any) => <MenuItem key={i.id} value={i.id}>{i.sku} - {i.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="From Warehouse" value={form.from_warehouse_id ?? ''} onChange={(e) => setForm({ ...form, from_warehouse_id: e.target.value })} margin="normal" size="small">
            {warehouses.map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth label="To Warehouse" value={form.to_warehouse_id ?? ''} onChange={(e) => setForm({ ...form, to_warehouse_id: e.target.value })} margin="normal" size="small">
            {warehouses.filter((w: any) => w.id !== Number(form.from_warehouse_id)).map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Quantity" type="number" value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value })} margin="normal" size="small" />
          <TextField fullWidth label="Notes (optional)" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} margin="normal" size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.item_id || !form.from_warehouse_id || !form.to_warehouse_id || !form.quantity || isPending}>
            {isPending ? 'Saving...' : 'Transfer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StockLedger;
