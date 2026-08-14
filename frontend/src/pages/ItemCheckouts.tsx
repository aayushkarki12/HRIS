import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  AssignmentReturn as ReturnIcon,
  Inventory2 as ItemIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { inventoryService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/common/EmptyState';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.04 } }),
};

const STATUS_COLOR: Record<string, any> = { checked_out: 'primary', returned: 'default' };

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const ItemCheckouts: React.FC = () => {
  const { isManager, hasPermission } = useAuth();
  const canViewAll = isManager || hasPermission('inventory.manage');
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ item_id: '', warehouse_id: '', quantity: '1', notes: '' });
  const [formError, setFormError] = useState('');

  const { data: checkouts = [], isLoading } = useQuery({
    queryKey: ['item-checkouts'],
    queryFn: () => inventoryService.getCheckouts(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items', 'for-checkout'],
    queryFn: () => inventoryService.getItems({ is_active: true }),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['inventory-setup', 'warehouses'],
    queryFn: () => inventoryService.getWarehouses({ is_active: true }),
  });

  const checkoutMutation = useMutation({
    mutationFn: (data: any) => inventoryService.checkoutItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-checkouts'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item checked out');
      closeModal();
    },
    onError: (e: any) => setFormError(getErrorMessage(e, 'Failed to check out item')),
  });

  const returnMutation = useMutation({
    mutationFn: (id: number) => inventoryService.returnCheckout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-checkouts'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item returned');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to return item')),
  });

  const closeModal = () => {
    setModalOpen(false);
    setForm({ item_id: '', warehouse_id: '', quantity: '1', notes: '' });
    setFormError('');
  };

  const submit = () => {
    setFormError('');
    if (!form.item_id || !form.warehouse_id) {
      setFormError('Item and warehouse are required');
      return;
    }
    checkoutMutation.mutate({
      item_id: Number(form.item_id),
      warehouse_id: Number(form.warehouse_id),
      quantity: Number(form.quantity) || 1,
      notes: form.notes || undefined,
    });
  };

  const selectedItem = (items as any[]).find((i: any) => i.id === Number(form.item_id));

  return (
    <Box>
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>Item Checkouts</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {canViewAll ? 'Who took what, when, and when it came back' : 'Take an inventory item and return it when you\'re done'}
            </Typography>
          </Box>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
            Take an Item
          </Button>
        </Box>
      </motion.div>

      {isLoading ? (
        <Skeleton height={240} sx={{ borderRadius: 2 }} variant="rectangular" />
      ) : (checkouts as any[]).length === 0 ? (
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <EmptyState
            icon={<ItemIcon sx={{ fontSize: 48, color: '#CBD5E1' }} />}
            title="No checkouts yet"
            description={canViewAll ? 'Employee item checkouts will appear here.' : 'Items you take out will show up here.'}
            action={{ label: 'Take an Item', onClick: () => setModalOpen(true) }}
          />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <Table sx={{ minWidth: 650 }} size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {[...(canViewAll ? ['Employee'] : []), 'Item', 'Qty', 'Checked Out At', 'Returned At', 'Status', 'Actions'].map((h) => (
                  <TableCell key={h} align={h === 'Actions' || h === 'Qty' ? 'right' : 'left'} sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(checkouts as any[]).map((c: any) => (
                <TableRow key={c.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                  {canViewAll && (
                    <TableCell>{c.employee ? `${c.employee.first_name} ${c.employee.last_name}` : `#${c.employee_id}`}</TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{c.item?.name ?? `Item #${c.item_id}`}</Typography>
                    {c.item?.sku && <Typography variant="caption" color="text.secondary">{c.item.sku}</Typography>}
                  </TableCell>
                  <TableCell align="right">{c.quantity}</TableCell>
                  <TableCell>{fmt(c.checked_out_at)}</TableCell>
                  <TableCell>{fmt(c.returned_at)}</TableCell>
                  <TableCell>
                    <Chip label={c.status === 'checked_out' ? 'Checked Out' : 'Returned'} color={STATUS_COLOR[c.status] ?? 'default'} size="small" sx={{ fontWeight: 600 }} />
                  </TableCell>
                  <TableCell align="right">
                    {c.status === 'checked_out' && (
                      <IconButton size="small" color="primary" title={canViewAll ? 'Force Return' : 'Return'}
                        onClick={() => returnMutation.mutate(c.id)} disabled={returnMutation.isPending}>
                        <ReturnIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={modalOpen} onClose={closeModal} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>Take an Item</DialogTitle>
        <DialogContent>
          {formError && <Typography color="error" variant="body2" sx={{ mb: 1.5 }}>{formError}</Typography>}
          <TextField fullWidth select label="Item" value={form.item_id}
            onChange={(e) => setForm({ ...form, item_id: e.target.value })} size="small" margin="normal">
            {(items as any[]).map((i: any) => (
              <MenuItem key={i.id} value={i.id} disabled={i.on_hand_quantity <= 0}>
                {i.name} ({i.sku}) — {i.on_hand_quantity} on hand
              </MenuItem>
            ))}
          </TextField>
          <TextField fullWidth select label="Warehouse" value={form.warehouse_id}
            onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} size="small" margin="normal">
            {(warehouses as any[]).map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth label="Quantity" type="number" value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })} size="small" margin="normal"
            slotProps={{ htmlInput: { min: 1, max: selectedItem?.on_hand_quantity ?? undefined } }} />
          <TextField fullWidth label="Notes (optional)" multiline rows={2} value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} size="small" margin="normal" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={closeModal} color="inherit">Cancel</Button>
          <Button size="small" variant="contained" onClick={submit} disabled={checkoutMutation.isPending}>
            {checkoutMutation.isPending ? 'Taking…' : 'Take Item'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemCheckouts;
