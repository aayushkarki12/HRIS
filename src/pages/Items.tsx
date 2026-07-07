import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, IconButton, MenuItem, InputAdornment, Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material';
import { inventoryService, accountingService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const money = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyForm = {
  sku: '', name: '', description: '', category_id: '', unit_id: '', default_supplier_id: '',
  cost_price: '', sale_price: '', reorder_level: '', min_stock: '', max_stock: '',
  inventory_account_id: '', cogs_account_id: '',
  opening_quantity: '', opening_warehouse_id: '', opening_unit_cost: '',
};

const Items: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', search],
    queryFn: () => inventoryService.getItems({ search: search || undefined }),
    enabled: isManager,
  });
  const { data: categories = [] } = useQuery({ queryKey: ['inventory-setup', 'categories'], queryFn: () => inventoryService.getCategories({ is_active: true }), enabled: isManager });
  const { data: units = [] } = useQuery({ queryKey: ['inventory-setup', 'units'], queryFn: () => inventoryService.getUnits({ is_active: true }), enabled: isManager });
  const { data: suppliers = [] } = useQuery({ queryKey: ['inventory-setup', 'suppliers'], queryFn: () => inventoryService.getSuppliers({ is_active: true }), enabled: isManager });
  const { data: warehouses = [] } = useQuery({ queryKey: ['inventory-setup', 'warehouses'], queryFn: () => inventoryService.getWarehouses({ is_active: true }), enabled: isManager });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountingService.getAccounts(), enabled: isManager });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing ? inventoryService.updateItem(editing.id, data) : inventoryService.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(editing ? 'Item updated' : 'Item created');
      closeModal();
    },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to save item')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => inventoryService.deactivateItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item deactivated');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to deactivate item')),
  });

  const openModal = (item?: any) => {
    setEditing(item ?? null);
    setForm(item ? {
      sku: item.sku, name: item.name, description: item.description ?? '',
      category_id: item.category_id ?? '', unit_id: item.unit_id ?? '', default_supplier_id: item.default_supplier_id ?? '',
      cost_price: String(item.cost_price ?? ''), sale_price: String(item.sale_price ?? ''),
      reorder_level: String(item.reorder_level ?? ''), min_stock: String(item.min_stock ?? ''), max_stock: item.max_stock != null ? String(item.max_stock) : '',
      inventory_account_id: item.inventory_account_id ?? '', cogs_account_id: item.cogs_account_id ?? '',
      opening_quantity: '', opening_warehouse_id: '', opening_unit_cost: '',
    } : emptyForm);
    setError('');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setError(''); };

  const submit = () => {
    setError('');
    const payload: any = {
      sku: form.sku, name: form.name, description: form.description || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      unit_id: form.unit_id ? Number(form.unit_id) : null,
      default_supplier_id: form.default_supplier_id ? Number(form.default_supplier_id) : null,
      cost_price: Number(form.cost_price) || 0, sale_price: Number(form.sale_price) || 0,
      reorder_level: Number(form.reorder_level) || 0, min_stock: Number(form.min_stock) || 0,
      max_stock: form.max_stock ? Number(form.max_stock) : null,
      inventory_account_id: form.inventory_account_id ? Number(form.inventory_account_id) : null,
      cogs_account_id: form.cogs_account_id ? Number(form.cogs_account_id) : null,
    };
    if (!editing) {
      payload.opening_quantity = Number(form.opening_quantity) || 0;
      payload.opening_warehouse_id = form.opening_warehouse_id ? Number(form.opening_warehouse_id) : null;
      payload.opening_unit_cost = Number(form.opening_unit_cost) || 0;
    }
    saveMutation.mutate(payload);
  };

  if (!isManager) return <AccessDenied />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Items</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Stock-keeping units, costed on a weighted-average basis
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}>New Item</Button>
        )}
      </Box>

      <TextField
        fullWidth size="small" placeholder="Search by SKU or name…" value={search}
        onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, maxWidth: 420 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                <TableCell><strong>SKU</strong></TableCell>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell align="right"><strong>On Hand</strong></TableCell>
                <TableCell align="right"><strong>Avg Cost</strong></TableCell>
                <TableCell align="right"><strong>Stock Value</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><Typography color="text.secondary">No items yet</Typography></TableCell></TableRow>
              ) : items.map((item: any) => {
                const category = categories.find((c: any) => c.id === item.category_id);
                const low = item.on_hand_quantity <= item.reorder_level;
                return (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{category?.name ?? '-'}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: item.on_hand_quantity <= 0 ? '#DC2626' : low ? '#D97706' : 'inherit' }}>
                        {item.on_hand_quantity}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{money(item.average_cost)}</TableCell>
                    <TableCell align="right">{money(item.stock_value)}</TableCell>
                    <TableCell>
                      {!item.is_active ? <Chip label="Inactive" size="small" /> :
                        item.on_hand_quantity <= 0 ? <Chip label="Out of Stock" color="error" size="small" /> :
                        low ? <Chip label="Low Stock" color="warning" size="small" /> :
                        <Chip label="Active" color="success" size="small" />}
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openModal(item)}><EditIcon fontSize="small" /></IconButton>
                        {item.is_active && (
                          <IconButton size="small" color="error" onClick={() => deactivateMutation.mutate(item.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={modalOpen} onClose={closeModal} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Item' : 'New Item'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 0.5 }}>
            <TextField label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} size="small" />
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} size="small" />
            <TextField select label="Category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} size="small">
              <MenuItem value="">None</MenuItem>
              {categories.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label="Unit" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} size="small">
              <MenuItem value="">None</MenuItem>
              {units.map((u: any) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>
            <TextField select label="Default Supplier" value={form.default_supplier_id} onChange={(e) => setForm({ ...form, default_supplier_id: e.target.value })} size="small">
              <MenuItem value="">None</MenuItem>
              {suppliers.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <TextField label="Sale Price" type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} size="small" />
            <TextField label="Reorder Level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} size="small" />
            <TextField label="Min Stock" type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} size="small" />
            <TextField label="Max Stock (optional)" type="number" value={form.max_stock} onChange={(e) => setForm({ ...form, max_stock: e.target.value })} size="small" />
            <TextField select label="Inventory Account (optional)" value={form.inventory_account_id} onChange={(e) => setForm({ ...form, inventory_account_id: e.target.value })} size="small">
              <MenuItem value="">None</MenuItem>
              {accounts.filter((a: any) => a.is_active).map((a: any) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
            </TextField>
            <TextField select label="COGS Account (optional)" value={form.cogs_account_id} onChange={(e) => setForm({ ...form, cogs_account_id: e.target.value })} size="small">
              <MenuItem value="">None</MenuItem>
              {accounts.filter((a: any) => a.is_active).map((a: any) => <MenuItem key={a.id} value={a.id}>{a.code} - {a.name}</MenuItem>)}
            </TextField>
          </Box>
          <TextField
            fullWidth multiline rows={2} label="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} margin="normal" size="small"
          />
          {!editing && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>Opening Stock (optional)</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mt: 0.5 }}>
                <TextField select label="Warehouse" value={form.opening_warehouse_id} onChange={(e) => setForm({ ...form, opening_warehouse_id: e.target.value })} size="small">
                  <MenuItem value="">None</MenuItem>
                  {warehouses.map((w: any) => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                </TextField>
                <TextField label="Quantity" type="number" value={form.opening_quantity} onChange={(e) => setForm({ ...form, opening_quantity: e.target.value })} size="small" />
                <TextField label="Unit Cost" type="number" value={form.opening_unit_cost} onChange={(e) => setForm({ ...form, opening_unit_cost: e.target.value })} size="small" />
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!form.sku || !form.name || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Items;
