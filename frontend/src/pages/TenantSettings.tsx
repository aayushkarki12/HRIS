import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  Alert,
  Skeleton,
  Collapse,
  MenuItem,
} from '@mui/material';
import {
  Save as SaveIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warehouse as WarehouseIcon,
  MyLocation as MyLocationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { tenantService, workLocationService } from '../services/api';
import LocationPickerMap from '../components/common/LocationPickerMap';

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.2, delay: i * 0.06 } }),
};

const SectionCard: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; index?: number; action?: React.ReactNode }> = ({ title, icon, children, index = 0, action }) => (
  <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', overflow: 'hidden', bgcolor: '#fff' }}>
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#FAFAFA' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon && <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>}
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{title}</Typography>
        </Box>
        {action}
      </Box>
      <Box sx={{ p: 3 }}>{children}</Box>
    </Box>
  </motion.div>
);

const FieldGrid: React.FC<{ children: React.ReactNode; cols?: number }> = ({ children, cols = 2 }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${cols}, 1fr)` }, gap: 2 }}>
    {children}
  </Box>
);

interface FormData {
  name: string; subdomain: string; email: string; phone: string;
  address: string; logo_url: string;
  office_latitude: string; office_longitude: string;
  office_radius: string; office_address: string;
}

const getErrorMessage = (error: any): string => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((e: any) => e.msg || e).join(', ');
  return error?.message || 'An unexpected error occurred';
};

const TenantSettings: React.FC = () => {
  const { tenant, user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>({
    name: '', subdomain: '', email: '', phone: '', address: '', logo_url: '',
    office_latitude: '', office_longitude: '', office_radius: '', office_address: '',
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '', subdomain: (tenant as any).subdomain || '',
        email: tenant.email || '', phone: tenant.phone || '',
        address: tenant.address || '', logo_url: tenant.logo_url || '',
        office_latitude: String((tenant as any).office_latitude ?? ''),
        office_longitude: String((tenant as any).office_longitude ?? ''),
        office_radius: String((tenant as any).office_radius ?? ''),
        office_address: (tenant as any).office_address || '',
      });
    }
  }, [tenant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload: any = {
        name: data.name, subdomain: data.subdomain, email: data.email,
        phone: data.phone, address: data.address, logo_url: data.logo_url,
        office_address: data.office_address || '',
        office_latitude: data.office_latitude ? parseFloat(data.office_latitude) : null,
        office_longitude: data.office_longitude ? parseFloat(data.office_longitude) : null,
        office_radius: data.office_radius ? parseInt(data.office_radius, 10) : 100,
      };
      return tenantService.updateMyTenant(payload);
    },
    onSuccess: (data) => {
      toast.success('Settings saved');
      localStorage.setItem('tenant', JSON.stringify({ ...tenant, ...data }));
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
    onError: (err: any) => toast.error(getErrorMessage(err)),
  });

  // Work locations
  const [locationModal, setLocationModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState<any>(null);
  const [locForm, setLocForm] = useState({ name: '', address: '', latitude: '', longitude: '', radius: '100', parentLocationId: '' });
  const [collapsedFactories, setCollapsedFactories] = useState<Set<number>>(new Set());
  const toggleFactory = (id: number) => setCollapsedFactories(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [locError, setLocError] = useState('');
  const [mapsLink, setMapsLink] = useState('');

  const resolveMapsLinkMutation = useMutation({
    mutationFn: (url: string) => workLocationService.resolveMapsLink(url),
    onSuccess: (result) => {
      setLocForm((prev) => ({ ...prev, latitude: String(result.latitude), longitude: String(result.longitude) }));
      toast.success('Coordinates pulled from the link');
    },
    onError: (e: any) => toast.error(getErrorMessage(e) || "Couldn't read coordinates from that link"),
  });

  // Separate instance for the Primary Office Location section above -
  // distinct state/mutation from the Work Location dialog's since they edit
  // different forms (formData.office_* vs locForm).
  const [officeMapsLink, setOfficeMapsLink] = useState('');

  const resolveOfficeMapsLinkMutation = useMutation({
    mutationFn: (url: string) => workLocationService.resolveMapsLink(url),
    onSuccess: (result) => {
      setFormData((prev) => ({ ...prev, office_latitude: String(result.latitude), office_longitude: String(result.longitude) }));
      toast.success('Coordinates pulled from the link');
    },
    onError: (e: any) => toast.error(getErrorMessage(e) || "Couldn't read coordinates from that link"),
  });

  const { data: workLocationsTree, isLoading: locLoading } = useQuery({
    queryKey: ['workLocationsTree'],
    queryFn: workLocationService.getTree,
    enabled: isAdmin,
  });

  const closeLocModal = () => {
    setLocationModal(false); setEditingLoc(null);
    setLocForm({ name: '', address: '', latitude: '', longitude: '', radius: '100', parentLocationId: '' });
    setLocError('');
    setMapsLink('');
  };

  const createLocMutation = useMutation({
    mutationFn: (d: any) => workLocationService.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workLocationsTree'] }); toast.success('Location added'); closeLocModal(); },
    onError: (e: any) => { const m = getErrorMessage(e); toast.error(m); setLocError(m); },
  });

  const updateLocMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => workLocationService.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workLocationsTree'] }); toast.success('Location updated'); closeLocModal(); },
    onError: (e: any) => { const m = getErrorMessage(e); toast.error(m); setLocError(m); },
  });

  const deleteLocMutation = useMutation({
    mutationFn: (id: number) => workLocationService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workLocationsTree'] }); toast.success('Location deactivated'); },
    onError: (e: any) => toast.error(getErrorMessage(e)),
  });

  const handleEditLoc = (loc: any) => {
    setEditingLoc(loc);
    setLocForm({
      name: loc.name, address: loc.address || '', latitude: String(loc.latitude), longitude: String(loc.longitude),
      radius: String(loc.radius), parentLocationId: loc.parent_location_id ? String(loc.parent_location_id) : '',
    });
    setLocationModal(true);
  };

  // Only top-level sites can be a parent (depth capped at 2 - a plant can't
  // itself have children), and a location can't be its own parent.
  const parentOptions = (workLocationsTree ?? []).filter((l: any) => !editingLoc || l.id !== editingLoc.id);
  const editingHasChildren = (editingLoc?.children?.length ?? 0) > 0;

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setLocForm(prev => ({ ...prev, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })); toast.success('Location captured'); },
      err => toast.error(err.message || 'Failed to get location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmitLoc = () => {
    setLocError('');
    const lat = parseFloat(locForm.latitude), lng = parseFloat(locForm.longitude);
    if (isNaN(lat) || isNaN(lng)) { setLocError('Latitude and longitude must be valid numbers'); return; }
    const payload = {
      name: locForm.name, address: locForm.address || null, latitude: lat, longitude: lng,
      radius: parseFloat(locForm.radius) || 100,
      parent_location_id: locForm.parentLocationId ? parseInt(locForm.parentLocationId, 10) : null,
    };
    if (editingLoc) updateLocMutation.mutate({ id: editingLoc.id, data: payload });
    else createLocMutation.mutate(payload);
  };

  if (!isAdmin) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h6" color="error" sx={{ mb: 1 }}>Access Denied</Typography>
          <Typography color="text.secondary">You don't have permission to view this page.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontFamily: "Georgia, 'Times New Roman', Times, serif", fontWeight: 700, letterSpacing: '-0.02em' }}>Organization Settings</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Manage your organization's profile and location configuration</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '10px', bgcolor: '#fff' }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>{tenant?.name?.[0]?.toUpperCase()}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{tenant?.name}</Typography>
              <Typography variant="caption" color="text.disabled">{(tenant as any)?.subdomain}.hris-system.com</Typography>
            </Box>
          </Box>
        </Box>
      </motion.div>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Org Info */}
        <SectionCard title="Organization Information" icon={<BusinessIcon sx={{ fontSize: 16 }} />} index={1}>
          <FieldGrid>
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <TextField size="small" fullWidth label="Organization Name" name="name" value={formData.name} onChange={handleChange} required />
            </Box>
            <TextField size="small" fullWidth label="Subdomain" name="subdomain" value={formData.subdomain} onChange={handleChange} required helperText="e.g. mycompany → mycompany.hris-system.com" />
            <TextField size="small" fullWidth label="Email" name="email" type="email" value={formData.email} onChange={handleChange} />
            <TextField size="small" fullWidth label="Phone" name="phone" value={formData.phone} onChange={handleChange} />
            <TextField size="small" fullWidth label="Logo URL" name="logo_url" value={formData.logo_url} onChange={handleChange} placeholder="https://example.com/logo.png" />
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <TextField size="small" fullWidth label="Address" name="address" value={formData.address} onChange={handleChange} multiline rows={2} />
            </Box>
          </FieldGrid>
        </SectionCard>

        {/* Office Location */}
        <SectionCard title="Primary Office Location" icon={<LocationIcon sx={{ fontSize: 16 }} />} index={2}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Used for geo-fenced attendance tracking. Employees within the radius will be marked as present at the office.
          </Typography>
          <LocationPickerMap
            latitude={formData.office_latitude ? parseFloat(formData.office_latitude) : null}
            longitude={formData.office_longitude ? parseFloat(formData.office_longitude) : null}
            onChange={(lat, lng) => setFormData({ ...formData, office_latitude: String(lat), office_longitude: String(lng) })}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 2 }}>
            Click the map, or drag the pin, to set the office location.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth size="small" label="Paste a Google Maps link"
              value={officeMapsLink} onChange={e => setOfficeMapsLink(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
            />
            <Button
              size="small" variant="outlined" sx={{ flexShrink: 0 }}
              disabled={!officeMapsLink.trim() || resolveOfficeMapsLinkMutation.isPending}
              onClick={() => resolveOfficeMapsLinkMutation.mutate(officeMapsLink.trim())}
            >
              {resolveOfficeMapsLinkMutation.isPending ? <CircularProgress size={14} /> : 'Use Link'}
            </Button>
          </Box>

          <FieldGrid cols={3}>
            <TextField size="small" fullWidth label="Latitude" name="office_latitude" type="number" value={formData.office_latitude} onChange={handleChange} placeholder="27.7172" />
            <TextField size="small" fullWidth label="Longitude" name="office_longitude" type="number" value={formData.office_longitude} onChange={handleChange} placeholder="85.3240" />
            <TextField size="small" fullWidth label="Radius (meters)" name="office_radius" type="number" value={formData.office_radius} onChange={handleChange} placeholder="100" />
            <Box sx={{ gridColumn: { sm: '1 / -1' } }}>
              <TextField size="small" fullWidth label="Office Address" name="office_address" value={formData.office_address} onChange={handleChange} multiline rows={2} placeholder="Full office address" />
            </Box>
          </FieldGrid>

          {tenant && (
            <Box sx={{ mt: 2, p: 2, borderRadius: '8px', bgcolor: '#F8FAFC', border: '1px solid', borderColor: 'divider', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.disabled">Status</Typography>
                <Box sx={{ mt: 0.25 }}>
                  <Chip label={tenant.is_active ? 'Active' : 'Inactive'} color={tenant.is_active ? 'success' : 'error'} size="small" />
                </Box>
              </Box>
              {(tenant as any).office_latitude && (
                <Box>
                  <Typography variant="caption" color="text.disabled">Coordinates</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>{(tenant as any).office_latitude}, {(tenant as any).office_longitude}</Typography>
                </Box>
              )}
              {(tenant as any).office_radius && (
                <Box>
                  <Typography variant="caption" color="text.disabled">Radius</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{(tenant as any).office_radius}m</Typography>
                </Box>
              )}
            </Box>
          )}
        </SectionCard>

        {/* Save button */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<SaveIcon sx={{ fontSize: 15 }} />} onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending} sx={{ fontWeight: 600 }}>
              {updateMutation.isPending ? <CircularProgress size={16} color="inherit" /> : 'Save Settings'}
            </Button>
          </Box>
        </motion.div>

        {/* Work Locations */}
        <SectionCard
          title="Work Locations"
          icon={<WarehouseIcon sx={{ fontSize: 16 }} />}
          index={4}
          action={
            <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => setLocationModal(true)} sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
              Add Location
            </Button>
          }
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Branch offices, warehouses, or client sites where employees are allowed to clock in remotely.
          </Typography>
          {locLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[1, 2].map(i => <Skeleton key={i} height={44} sx={{ borderRadius: 1 }} />)}
            </Box>
          ) : (
            <TableContainer>
              <Table sx={{ minWidth: 600 }} size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' } }}>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Coordinates</TableCell>
                    <TableCell align="right">Radius</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(!workLocationsTree || workLocationsTree.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">No additional work locations configured</Typography>
                      </TableCell>
                    </TableRow>
                  ) : workLocationsTree.map((loc: any) => {
                    const hasChildren = (loc.children?.length ?? 0) > 0;
                    const expanded = !collapsedFactories.has(loc.id);
                    return (
                      <React.Fragment key={loc.id}>
                        <TableRow hover sx={{ '& td': { fontSize: '0.8125rem' } }}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {hasChildren ? (
                                <IconButton size="small" onClick={() => toggleFactory(loc.id)} sx={{ p: 0.25 }}>
                                  {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                                </IconButton>
                              ) : (
                                <Box sx={{ width: 24 }} />
                              )}
                              {loc.name}
                              {hasChildren && (
                                <Chip label={`${loc.children.length} plant${loc.children.length > 1 ? 's' : ''}`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell color="text.secondary">{loc.address || '—'}</TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{loc.radius}m</TableCell>
                          <TableCell>
                            <Chip label={loc.is_active ? 'Active' : 'Inactive'} color={loc.is_active ? 'success' : 'default'} size="small" />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => handleEditLoc(loc)}><EditIcon sx={{ fontSize: 15 }} /></IconButton>
                            {loc.is_active && (
                              <IconButton size="small" color="error" onClick={() => deleteLocMutation.mutate(loc.id)}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                        {hasChildren && (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                              <Collapse in={expanded} timeout="auto" unmountOnExit>
                                <Table size="small">
                                  <TableBody>
                                    {loc.children.map((child: any) => (
                                      <TableRow key={child.id} hover sx={{ '& td': { fontSize: '0.8125rem', bgcolor: '#FAFAFA' } }}>
                                        <TableCell sx={{ pl: 6 }}>{child.name}</TableCell>
                                        <TableCell color="text.secondary">{child.address || '—'}</TableCell>
                                        <TableCell>
                                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                            {child.latitude.toFixed(5)}, {child.longitude.toFixed(5)}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">{child.radius}m</TableCell>
                                        <TableCell>
                                          <Chip label={child.is_active ? 'Active' : 'Inactive'} color={child.is_active ? 'success' : 'default'} size="small" />
                                        </TableCell>
                                        <TableCell align="right">
                                          <IconButton size="small" onClick={() => handleEditLoc(child)}><EditIcon sx={{ fontSize: 15 }} /></IconButton>
                                          {child.is_active && (
                                            <IconButton size="small" color="error" onClick={() => deleteLocMutation.mutate(child.id)}><DeleteIcon sx={{ fontSize: 15 }} /></IconButton>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>
      </Box>

      {/* Work Location Dialog */}
      <Dialog open={locationModal} onClose={closeLocModal} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem', pb: 1 }}>
          {editingLoc ? 'Edit Work Location' : 'Add Work Location'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {locError && <Alert severity="error" sx={{ mb: 2 }}>{locError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <TextField fullWidth size="small" label="Location Name" value={locForm.name} onChange={e => setLocForm({ ...locForm, name: e.target.value })} placeholder="e.g. Hetauda Warehouse" required />
            <TextField fullWidth size="small" label="Address" value={locForm.address} onChange={e => setLocForm({ ...locForm, address: e.target.value })} placeholder="Optional" />
            <TextField
              fullWidth size="small" select label="Part of factory/site"
              value={locForm.parentLocationId}
              onChange={e => setLocForm({ ...locForm, parentLocationId: e.target.value })}
              disabled={editingHasChildren}
              helperText={editingHasChildren ? 'This location already has its own plants and cannot become a plant itself' : 'Leave as None for a top-level site/factory'}
            >
              <MenuItem value="">None (top-level site/factory)</MenuItem>
              {parentOptions.map((opt: any) => (
                <MenuItem key={opt.id} value={String(opt.id)}>{opt.name}</MenuItem>
              ))}
            </TextField>

            <LocationPickerMap
              latitude={locForm.latitude ? parseFloat(locForm.latitude) : null}
              longitude={locForm.longitude ? parseFloat(locForm.longitude) : null}
              onChange={(lat, lng) => setLocForm({ ...locForm, latitude: String(lat), longitude: String(lng) })}
              defaultCenter={
                (tenant as any)?.office_latitude && (tenant as any)?.office_longitude
                  ? [(tenant as any).office_latitude, (tenant as any).office_longitude]
                  : undefined
              }
            />
            <Typography variant="caption" color="text.secondary">Click the map, or drag the pin, to set the location.</Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth size="small" label="Paste a Google Maps link"
                value={mapsLink} onChange={e => setMapsLink(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
              />
              <Button
                size="small" variant="outlined" sx={{ flexShrink: 0 }}
                disabled={!mapsLink.trim() || resolveMapsLinkMutation.isPending}
                onClick={() => resolveMapsLinkMutation.mutate(mapsLink.trim())}
              >
                {resolveMapsLinkMutation.isPending ? <CircularProgress size={14} /> : 'Use Link'}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField size="small" label="Latitude" type="number" value={locForm.latitude} onChange={e => setLocForm({ ...locForm, latitude: e.target.value })} placeholder="27.4287" fullWidth />
              <TextField size="small" label="Longitude" type="number" value={locForm.longitude} onChange={e => setLocForm({ ...locForm, longitude: e.target.value })} placeholder="85.0322" fullWidth />
            </Box>
            <Button size="small" startIcon={<MyLocationIcon sx={{ fontSize: 14 }} />} onClick={handleUseMyLocation} sx={{ alignSelf: 'flex-start', fontWeight: 600 }}>
              Use My Current Location
            </Button>
            <TextField fullWidth size="small" label="Radius (meters)" type="number" value={locForm.radius} onChange={e => setLocForm({ ...locForm, radius: e.target.value })} helperText="How close an employee must be to clock in at this location" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeLocModal} size="small" color="inherit">Cancel</Button>
          <Button variant="contained" size="small" onClick={handleSubmitLoc} disabled={!locForm.name || !locForm.latitude || !locForm.longitude || createLocMutation.isPending || updateLocMutation.isPending} sx={{ fontWeight: 600 }}>
            {createLocMutation.isPending || updateLocMutation.isPending ? <CircularProgress size={14} color="inherit" /> : editingLoc ? 'Update' : 'Create Location'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TenantSettings;
