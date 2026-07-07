import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, IconButton, Tabs, Tab,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { inventoryService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

type Entity = 'warehouses' | 'categories' | 'units' | 'suppliers';

const ENTITY_META: Record<Entity, { title: string; fields: { key: string; label: string; placeholder?: string }[] }> = {
  warehouses: { title: 'Warehouse', fields: [{ key: 'code', label: 'Code', placeholder: 'e.g. WH-MAIN' }, { key: 'name', label: 'Name' }, { key: 'address', label: 'Address' }] },
  categories: { title: 'Category', fields: [{ key: 'code', label: 'Code', placeholder: 'e.g. ELEC' }, { key: 'name', label: 'Name' }] },
  units: { title: 'Unit of Measure', fields: [{ key: 'code', label: 'Code', placeholder: 'e.g. PCS' }, { key: 'name', label: 'Name', placeholder: 'e.g. Pieces' }] },
  suppliers: { title: 'Supplier', fields: [{ key: 'code', label: 'Code', placeholder: 'e.g. SUP-001' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'address', label: 'Address' }] },
};

const SERVICE_MAP: Record<Entity, { get: (p?: any) => Promise<any>; create: (d: any) => Promise<any>; update: (id: number, d: any) => Promise<any>; deactivate: (id: number) => Promise<any> }> = {
  warehouses: { get: inventoryService.getWarehouses, create: inventoryService.createWarehouse, update: inventoryService.updateWarehouse, deactivate: inventoryService.deactivateWarehouse },
  categories: { get: inventoryService.getCategories, create: inventoryService.createCategory, update: inventoryService.updateCategory, deactivate: inventoryService.deactivateCategory },
  units: { get: inventoryService.getUnits, create: inventoryService.createUnit, update: inventoryService.updateUnit, deactivate: inventoryService.deactivateUnit },
  suppliers: { get: inventoryService.getSuppliers, create: inventoryService.createSupplier, update: inventoryService.updateSupplier, deactivate: inventoryService.deactivateSupplier },
};

const ENTITY_ORDER: Entity[] = ['warehouses', 'categories', 'units', 'suppliers'];

const InventorySetup: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const entity = ENTITY_ORDER[tab];
  const meta = ENTITY_META[entity];
  const service = SERVICE_MAP[entity];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['inventory-setup', entity],
    queryFn: () => service.get(),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing ? service.update(editing.id, data) : service.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-setup', entity] });
      toast.success(editing ? `${meta.title} updated` : `${meta.title} created`);
      closeModal();
    },
    onError: (e: any) => setError(getErrorMessage(e, `Failed to save ${meta.title.toLowerCase()}`)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => service.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-setup', entity] });
      toast.success(`${meta.title} deactivated`);
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to deactivate')),
  });

  const openModal = (row?: any) => {
    setEditing(row ?? null);
    const initial: Record<string, string> = {};
    meta.fields.forEach((f) => { initial[f.key] = row?.[f.key] ?? ''; });
    setForm(initial);
    setError('');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setError(''); };

  const submit = () => {
    setError('');
    const payload: any = {};
    meta.fields.forEach((f) => { payload[f.key] = form[f.key] || (f.key === 'address' || f.key === 'email' || f.key === 'phone' ? null : ''); });
    saveMutation.mutate(payload);
  };

  const requiredFilled = meta.fields.filter((f) => ['code', 'name'].includes(f.key)).every((f) => form[f.key]);

  if (!isManager) return <AccessDenied />;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Inventory Setup</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Warehouses, categories, units of measure, and suppliers used across the stock ledger
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Warehouses" />
          <Tab label="Categories" />
          <Tab label="Units" />
          <Tab label="Suppliers" />
        </Tabs>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        {isAdmin && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openModal()}>
            New {meta.title}
          </Button>
        )}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                {meta.fields.map((f) => <TableCell key={f.key}><strong>{f.label}</strong></TableCell>)}
                <TableCell><strong>Status</strong></TableCell>
                {isAdmin && <TableCell align="right"><strong>Actions</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={meta.fields.length + 2} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No {meta.title.toLowerCase()}s yet</Typography>
                </TableCell></TableRow>
              ) : rows.map((row: any) => (
                <TableRow key={row.id} hover>
                  {meta.fields.map((f) => (
                    <TableCell key={f.key} sx={f.key === 'code' ? { fontFamily: 'monospace', fontWeight: 600 } : undefined}>
                      {row[f.key] || '-'}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Chip label={row.is_active ? 'Active' : 'Inactive'} color={row.is_active ? 'success' : 'default'} size="small" />
                  </TableCell>
                  {isAdmin && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openModal(row)}><EditIcon fontSize="small" /></IconButton>
                      {row.is_active && (
                        <IconButton size="small" color="error" onClick={() => deactivateMutation.mutate(row.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={modalOpen} onClose={closeModal} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? `Edit ${meta.title}` : `New ${meta.title}`}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {meta.fields.map((f) => (
            <TextField
              key={f.key} fullWidth label={f.label} placeholder={f.placeholder}
              value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              margin="normal" size="small"
              multiline={f.key === 'address'} rows={f.key === 'address' ? 2 : undefined}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!requiredFilled || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventorySetup;
