import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  InputAdornment, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
  ExpandMore as ExpandMoreIcon, ChevronRight as ChevronRightIcon, DragIndicator as DragIcon,
  AccountBalance as AssetIcon, CreditCard as LiabilityIcon, PieChart as EquityIcon,
  TrendingUp as IncomeIcon, TrendingDown as ExpenseIcon, Folder as FolderIcon,
} from '@mui/icons-material';
import { accountingService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';

const NATURE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  asset: { label: 'Asset', color: '#2563EB', icon: AssetIcon },
  liability: { label: 'Liability', color: '#DC2626', icon: LiabilityIcon },
  equity: { label: 'Equity', color: '#7C3AED', icon: EquityIcon },
  income: { label: 'Income', color: '#16A34A', icon: IncomeIcon },
  expense: { label: 'Expense', color: '#D97706', icon: ExpenseIcon },
};

const money = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyForm = { code: '', name: '', nature: 'asset', color: '', icon: '', parent_id: '' as number | '' };

interface GroupNode {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  nature: string;
  color?: string | null;
  icon?: string | null;
  sort_order: number;
  is_active: boolean;
  account_count: number;
  total_debit: number;
  total_credit: number;
  balance: number;
  children: GroupNode[];
}

const flatten = (nodes: GroupNode[], depth = 0, out: { node: GroupNode; depth: number }[] = []) => {
  for (const n of nodes) {
    out.push({ node: n, depth });
    flatten(n.children, depth + 1, out);
  }
  return out;
};

const matchesSearch = (node: GroupNode, q: string): boolean => {
  if (!q) return true;
  const hit = node.name.toLowerCase().includes(q) || node.code.toLowerCase().includes(q);
  return hit || node.children.some((c) => matchesSearch(c, q));
};

const LedgerGroups: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GroupNode | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [dragOverId, setDragOverId] = useState<number | null | 'root'>(null);

  const { data: tree, isLoading } = useQuery<GroupNode[]>({
    queryKey: ['ledger-groups-tree'],
    queryFn: () => accountingService.getLedgerGroupTree(),
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ['ledger-groups'],
    queryFn: () => accountingService.getLedgerGroups(),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing ? accountingService.updateLedgerGroup(editing.id, data) : accountingService.createLedgerGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-groups-tree'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-groups'] });
      toast.success(editing ? 'Ledger group updated' : 'Ledger group created');
      closeModal();
    },
    onError: (e: any) => setError(getErrorMessage(e, 'Failed to save ledger group')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountingService.deleteLedgerGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-groups-tree'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-groups'] });
      toast.success('Ledger group deleted');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to delete ledger group')),
  });

  const reparentMutation = useMutation({
    mutationFn: ({ id, parent_id }: { id: number; parent_id: number | null }) =>
      accountingService.updateLedgerGroup(id, { parent_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-groups-tree'] });
      queryClient.invalidateQueries({ queryKey: ['ledger-groups'] });
      toast.success('Group moved');
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to move group')),
  });

  const openModal = (node?: GroupNode, parentId?: number) => {
    setEditing(node ?? null);
    setForm(node
      ? { code: node.code, name: node.name, nature: node.nature, color: node.color ?? '', icon: node.icon ?? '', parent_id: node.parent_id ?? '' }
      : { ...emptyForm, parent_id: parentId ?? '' });
    setError('');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); setError(''); };

  const submit = () => {
    setError('');
    saveMutation.mutate({
      code: form.code,
      name: form.name,
      nature: form.nature,
      color: form.color || null,
      icon: form.icon || null,
      parent_id: form.parent_id === '' ? null : Number(form.parent_id),
    });
  };

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    if (!tree) return [];
    const q = search.trim().toLowerCase();
    const filteredRoots = q ? tree.filter((n) => matchesSearch(n, q)) : tree;
    const rows = flatten(filteredRoots);
    if (q) return rows;
    // Hide rows whose ancestor chain passes through a collapsed group (only when not searching).
    const idToNode = new Map(rows.map((r) => [r.node.id, r.node]));
    return rows.filter(({ node }) => {
      let current: GroupNode | undefined = node;
      while (current && current.parent_id != null) {
        if (collapsed.has(current.parent_id)) return false;
        current = idToNode.get(current.parent_id);
      }
      return true;
    });
  }, [tree, search, collapsed]);

  if (!isManager) return <AccessDenied />;

  if (isLoading || !tree) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Ledger Groups</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Hierarchical groups for the chart of accounts — balances roll up automatically from ledgers to their parent groups
          </Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}>
            New Group
          </Button>
        )}
      </Box>

      <TextField
        fullWidth size="small" placeholder="Search groups by code or name…"
        value={search} onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 420 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
      />

      <Paper
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'hidden' }}
        onDragOver={(e) => { e.preventDefault(); setDragOverId('root'); }}
        onDragLeave={() => setDragOverId((d) => (d === 'root' ? null : d))}
        onDrop={(e) => {
          e.preventDefault();
          const id = Number(e.dataTransfer.getData('text/group-id'));
          if (id) reparentMutation.mutate({ id, parent_id: null });
          setDragOverId(null);
        }}
      >
        <Box sx={{
          display: 'grid', gridTemplateColumns: '1fr 120px 140px 140px 140px 100px',
          px: 2, py: 1.25, bgcolor: '#F8FAFC', borderBottom: '1px solid', borderColor: 'divider',
        }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>GROUP</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>NATURE</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }} align="right">LEDGERS</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }} align="right">DEBIT</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }} align="right">BALANCE</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }} align="right">ACTIONS</Typography>
        </Box>

        {dragOverId === 'root' && (
          <Box sx={{ px: 2, py: 1, bgcolor: 'primary.50', color: 'primary.main', fontSize: 12, fontWeight: 600 }}>
            Drop here to make this a top-level group
          </Box>
        )}

        {visibleRows.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <FolderIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              {search ? 'No groups match your search' : 'No ledger groups yet — create one to start organizing your chart of accounts'}
            </Typography>
          </Box>
        ) : (
          visibleRows.map(({ node, depth }) => {
            const nature = NATURE_META[node.nature] ?? NATURE_META.asset;
            const hasChildren = node.children.length > 0;
            const isCollapsed = collapsed.has(node.id);
            const color = node.color || nature.color;
            return (
              <Box
                key={node.id}
                draggable={isAdmin}
                onDragStart={(e) => { e.dataTransfer.setData('text/group-id', String(node.id)); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(node.id); }}
                onDragLeave={() => setDragOverId((d) => (d === node.id ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const draggedId = Number(e.dataTransfer.getData('text/group-id'));
                  if (draggedId && draggedId !== node.id) {
                    reparentMutation.mutate({ id: draggedId, parent_id: node.id });
                  }
                  setDragOverId(null);
                }}
                sx={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 140px 140px 140px 100px',
                  alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider',
                  bgcolor: dragOverId === node.id ? `${color}14` : 'transparent',
                  outline: dragOverId === node.id ? `2px dashed ${color}` : 'none',
                  outlineOffset: -2,
                  '&:hover': { bgcolor: '#F8FAFC' },
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: depth * 3 }}>
                  {isAdmin && <DragIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'grab' }} />}
                  {hasChildren ? (
                    <IconButton size="small" onClick={() => toggleCollapse(node.id)} sx={{ p: 0.25 }}>
                      {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  ) : (
                    <Box sx={{ width: 28 }} />
                  )}
                  <Box sx={{
                    width: 26, height: 26, borderRadius: '7px', bgcolor: `${color}1A`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <nature.icon sx={{ fontSize: 15, color }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {node.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{node.code}</Typography>
                  </Box>
                </Box>
                <Chip label={nature.label} size="small" sx={{ bgcolor: `${color}1A`, color, fontWeight: 700, width: 'fit-content' }} />
                <Typography variant="body2" align="right" color="text.secondary">{node.account_count}</Typography>
                <Typography variant="body2" align="right">{money(node.total_debit)}</Typography>
                <Typography variant="body2" align="right" sx={{ fontWeight: 700 }}>{money(node.balance)}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                  {isAdmin && (
                    <>
                      <Tooltip title="Add sub-group">
                        <IconButton size="small" onClick={() => openModal(undefined, node.id)}><AddIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openModal(node)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(node.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Paper>

      <Dialog open={modalOpen} onClose={closeModal} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Edit Ledger Group' : 'New Ledger Group'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField fullWidth label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} margin="normal" size="small" placeholder="e.g. CUR-ASSETS" />
          <TextField fullWidth label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="normal" size="small" placeholder="e.g. Current Assets" />
          <TextField select fullWidth label="Nature" value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value })} margin="normal" size="small">
            {Object.entries(NATURE_META).map(([value, meta]) => <MenuItem key={value} value={value}>{meta.label}</MenuItem>)}
          </TextField>
          <TextField
            select fullWidth label="Parent Group (optional)" value={form.parent_id}
            onChange={(e) => setForm({ ...form, parent_id: e.target.value === '' ? '' : Number(e.target.value) })}
            margin="normal" size="small"
          >
            <MenuItem value="">— Top Level —</MenuItem>
            {allGroups.filter((g: any) => !editing || g.id !== editing.id).map((g: any) => (
              <MenuItem key={g.id} value={g.id}>{g.code} — {g.name}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Color (optional)" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} margin="normal" size="small" placeholder="#2563EB" />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!form.code || !form.name || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LedgerGroups;
