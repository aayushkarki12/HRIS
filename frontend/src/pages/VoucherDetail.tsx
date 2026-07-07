import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Divider, Chip, IconButton, Skeleton, Tooltip, Avatar, Stack,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Print as PrintIcon,
  PictureAsPdf as PdfIcon,
  ContentCopy as DuplicateIcon,
  SyncAlt as ReverseIcon,
  History as HistoryIcon,
  Send as SubmitIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Block as CancelIcon,
  Publish as PostIcon,
  Business as CompanyIcon,
  Person as PartyIcon,
  Description as VoucherInfoIcon,
  ReceiptLong as EntriesIcon,
  Percent as TaxIcon,
  Timeline as TimelineIcon,
  AttachFile as AttachmentIcon,
  Link as LinkIcon,
  CheckCircleOutlined,
  RadioButtonUnchecked,
  HighlightOff,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { voucherService, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AccessDenied from '../components/common/AccessDenied';
import StatusBadge from './vouchers/StatusBadge';
import SectionCard from './vouchers/SectionCard';
import AuditTrailDrawer from './vouchers/AuditTrailDrawer';
import {
  voucherMeta, money, fmtDate, fmtDateTime, userName, fiscalYear,
  taxBreakdown, RELATED_SOURCE_LABELS,
} from './vouchers/voucherMeta';

const VoucherDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isManager, tenant } = useAuth();
  const queryClient = useQueryClient();
  const [auditOpen, setAuditOpen] = useState(false);

  const { data: voucher, isLoading } = useQuery({
    queryKey: ['voucher', id],
    queryFn: () => voucherService.getById(Number(id)),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['voucher', id] });
    queryClient.invalidateQueries({ queryKey: ['vouchers'] });
  };

  const submitMutation = useMutation({
    mutationFn: () => voucherService.submit(Number(id)),
    onSuccess: () => { toast.success('Voucher submitted for approval'); invalidate(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to submit')),
  });
  const approveMutation = useMutation({
    mutationFn: () => voucherService.approve(Number(id)),
    onSuccess: () => { toast.success('Voucher approved'); invalidate(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to approve')),
  });
  const rejectMutation = useMutation({
    mutationFn: () => voucherService.reject(Number(id), window.prompt('Reason for rejection (optional):') || undefined),
    onSuccess: () => { toast.success('Voucher rejected'); invalidate(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to reject')),
  });
  const cancelMutation = useMutation({
    mutationFn: () => voucherService.cancel(Number(id), window.prompt('Reason for cancellation (optional):') || undefined),
    onSuccess: () => { toast.success('Voucher cancelled'); invalidate(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to cancel')),
  });
  const postMutation = useMutation({
    mutationFn: () => voucherService.post(Number(id)),
    onSuccess: () => { toast.success('Voucher posted to the general ledger'); invalidate(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to post')),
  });
  const reverseMutation = useMutation({
    mutationFn: () => {
      const lines = (voucher.journal_entry?.lines ?? []).map((l: any) => ({
        account_id: l.account_id,
        description: l.description ?? undefined,
        debit: Number(l.credit) || 0,
        credit: Number(l.debit) || 0,
        cost_center_id: l.cost_center_id ?? undefined,
        tax_rate_id: l.tax_rate_id ?? undefined,
      }));
      return voucherService.create({
        voucher_type: voucher.voucher_type,
        voucher_date: new Date().toISOString().slice(0, 10),
        description: `Reversal of ${voucher.voucher_number}`,
        currency: voucher.currency,
        party_type: voucher.party_type,
        party_name: voucher.party_name,
        payment_method: voucher.payment_method,
        reference_number: voucher.voucher_number,
        remarks: `Auto-generated reversal of ${voucher.voucher_number}`,
        lines,
      });
    },
    onSuccess: (created: any) => {
      toast.success(`Reversal voucher ${created.voucher_number} created as draft`);
      navigate(`/vouchers/${created.id}`);
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'Failed to create reversal voucher')),
  });

  const handleDuplicate = () => {
    if (!voucher) return;
    const lines = (voucher.journal_entry?.lines ?? []).map((l: any) => ({
      account_id: l.account_id, description: l.description, debit: l.debit, credit: l.credit,
      cost_center_id: l.cost_center_id, tax_rate_id: l.tax_rate_id,
    }));
    navigate('/vouchers/new', {
      state: {
        duplicateFrom: {
          voucher_type: voucher.voucher_type,
          party_name: voucher.party_name,
          payment_method: voucher.payment_method,
          reference_number: voucher.reference_number,
          description: voucher.journal_entry?.description,
          lines,
        },
      },
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inField = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      if (inField) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); window.print(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); handleDuplicate(); }
      else if (e.key === 'Escape') { navigate('/vouchers'); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher]);

  const lines = voucher?.journal_entry?.lines ?? [];
  const isBalanced = voucher ? Math.abs((voucher.total_debit ?? 0) - (voucher.total_credit ?? 0)) < 0.01 : true;
  const runningBalances = useMemo(() => {
    let running = 0;
    return lines.map((l: any) => {
      running += (Number(l.debit) || 0) - (Number(l.credit) || 0);
      return running;
    });
  }, [lines]);
  const tax = useMemo(() => taxBreakdown(lines, voucher?.currency), [lines, voucher?.currency]);

  if (!isManager) return <AccessDenied />;

  if (isLoading || !voucher) {
    return (
      <Box>
        <Skeleton height={40} width={240} sx={{ mb: 2 }} />
        <Stack spacing={2}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
        </Stack>
      </Box>
    );
  }

  const meta = voucherMeta(voucher.voucher_type);

  const approvalStages = [
    { key: 'created', label: 'Created', user: voucher.preparer, time: voucher.created_at, done: true },
    { key: 'submitted', label: 'Submitted', user: undefined, time: voucher.submitted_at, done: !!voucher.submitted_at, skipped: !voucher.submitted_at && ['approved', 'posted'].includes(voucher.status) },
    voucher.status === 'rejected'
      ? { key: 'rejected', label: 'Rejected', user: voucher.approver, time: voucher.approved_at, done: true, error: true }
      : { key: 'approved', label: 'Approved', user: voucher.approver, time: voucher.approved_at, done: !!voucher.approved_at },
    { key: 'posted', label: 'Posted to Ledger', user: voucher.poster, time: voucher.posted_at, done: !!voucher.posted_at },
  ];

  const relatedItems: { label: string; path: string }[] = [];
  if (voucher.journal_entry_id) relatedItems.push({ label: `Journal Entry ${voucher.journal_entry?.entry_number ?? '#' + voucher.journal_entry_id}`, path: '/journal-entries' });
  if (voucher.source_type && voucher.source_type !== 'manual' && voucher.source_id) {
    const src = RELATED_SOURCE_LABELS[voucher.source_type];
    if (src) relatedItems.push({ label: `${src.label} #${voucher.source_id}`, path: src.path });
  }

  return (
    <Box>
      {/* Screen-only toolbar */}
      <Box className="no-print" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={() => navigate('/vouchers')} size="small" aria-label="Back to vouchers"><BackIcon /></IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{voucher.voucher_number}</Typography>
          <StatusBadge status={voucher.status} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Ctrl+P">
            <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
          </Tooltip>
          <Button size="small" variant="outlined" startIcon={<PdfIcon />} onClick={() => window.print()}>Export PDF</Button>
          <Tooltip title="Ctrl+D">
            <Button size="small" variant="outlined" startIcon={<DuplicateIcon />} onClick={handleDuplicate}>Duplicate</Button>
          </Tooltip>
          {isAdmin && voucher.status === 'posted' && (
            <Button size="small" variant="outlined" color="warning" startIcon={<ReverseIcon />} onClick={() => reverseMutation.mutate()} disabled={reverseMutation.isPending}>
              Reverse
            </Button>
          )}
          <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => setAuditOpen(true)}>Audit Trail</Button>
          {isAdmin && voucher.status === 'draft' && (
            <Button size="small" variant="contained" startIcon={<SubmitIcon />} onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              Submit for Approval
            </Button>
          )}
          {isAdmin && voucher.status === 'submitted' && (
            <>
              <Button size="small" variant="contained" color="success" startIcon={<ApproveIcon />} onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                Approve
              </Button>
              <Button size="small" variant="outlined" color="error" startIcon={<RejectIcon />} onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                Reject
              </Button>
            </>
          )}
          {isAdmin && (voucher.status === 'draft' || voucher.status === 'approved') && (
            <Button size="small" variant="contained" color="success" startIcon={<PostIcon />} onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
              Post to Ledger
            </Button>
          )}
          {isAdmin && ['draft', 'submitted', 'approved'].includes(voucher.status) && (
            <Button size="small" variant="outlined" color="inherit" startIcon={<CancelIcon />} onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Cancel
            </Button>
          )}
        </Box>
      </Box>

      <Box id="voucher-print-area" sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
        {['cancelled', 'draft', 'posted'].includes(voucher.status) && (
          <Box className="print-watermark" sx={{ display: 'none' }}>{voucher.status.toUpperCase()}</Box>
        )}

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Paper sx={{
            borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none',
            p: 3, bgcolor: `${meta.color}0D`, borderBottom: '3px solid', borderBottomColor: meta.color,
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar src={tenant?.logo_url} variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontWeight: 800 }}>
                  {(tenant?.name ?? 'H')[0].toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{tenant?.name ?? 'Company'}</Typography>
                  {tenant?.address && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{tenant.address}</Typography>}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {[tenant?.phone, tenant?.email].filter(Boolean).join('  ·  ') || `Tenant ID: ${voucher.tenant_id}`}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { sm: 'flex-end' } }}>
                  <meta.icon sx={{ color: meta.color }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: meta.color }}>{voucher.voucher_label}</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{voucher.voucher_number}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {fmtDate(voucher.voucher_date)} · {fiscalYear(voucher.voucher_date)} · {voucher.currency}
                </Typography>
                <Box sx={{ mt: 0.5, display: 'flex', justifyContent: { sm: 'flex-end' } }}>
                  <StatusBadge status={voucher.status} size="medium" />
                </Box>
              </Box>
            </Box>
          </Paper>
        </motion.div>

        {/* CARD 1 + 2: COMPANY / PARTY */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <SectionCard title="Company Information" icon={CompanyIcon} index={1}>
            <Stack spacing={0.75}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{tenant?.name ?? '—'}</Typography>
              <Typography variant="body2" color="text.secondary">{tenant?.address || 'No address on file'}</Typography>
              <Typography variant="body2" color="text.secondary">{tenant?.phone || '—'}</Typography>
              <Typography variant="body2" color="text.secondary">{tenant?.email || '—'}</Typography>
            </Stack>
          </SectionCard>

          <SectionCard title="Party Information" icon={PartyIcon} index={2}>
            {voucher.party_name ? (
              <Stack spacing={0.75}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{voucher.party_name}</Typography>
                  {voucher.party_type && <Chip label={voucher.party_type} size="small" sx={{ textTransform: 'capitalize' }} />}
                </Box>
                {voucher.reference_number && <Typography variant="body2" color="text.secondary">Ref: {voucher.reference_number}</Typography>}
                {voucher.due_date && <Typography variant="body2" color="text.secondary">Due: {fmtDate(voucher.due_date)}</Typography>}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">No party recorded for this voucher.</Typography>
            )}
          </SectionCard>
        </Box>

        {/* CARD 3: VOUCHER INFORMATION */}
        <SectionCard title="Voucher Information" icon={VoucherInfoIcon} index={3}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: voucher.journal_entry?.description ? 2 : 0 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Reference No</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{voucher.reference_number || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Payment Mode</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{voucher.payment_method || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Prepared By</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{userName(voucher.preparer)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Posting Date</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{voucher.posted_at ? fmtDate(voucher.posted_at) : '—'}</Typography>
            </Box>
          </Box>
          {voucher.journal_entry?.description && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Narration</Typography>
              <Typography variant="body2">{voucher.journal_entry.description}</Typography>
            </>
          )}
        </SectionCard>

        {/* ACCOUNTING ENTRIES */}
        <SectionCard
          title="Accounting Entries"
          icon={EntriesIcon}
          index={4}
          action={
            <Chip
              size="small"
              label={isBalanced ? 'Balanced' : 'Out of Balance'}
              color={isBalanced ? 'success' : 'error'}
              sx={{ fontWeight: 700 }}
            />
          }
        >
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, borderBottom: '2px solid', borderColor: 'divider' } }}>
                  <TableCell>Ledger</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Cost Center</TableCell>
                  <TableCell>Tax Code</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l: any, i: number) => (
                  <TableRow key={l.id} hover>
                    <TableCell>{l.account ? `${l.account.code} - ${l.account.name}` : '-'}</TableCell>
                    <TableCell>{l.description || '-'}</TableCell>
                    <TableCell>{l.cost_center ? l.cost_center.name : '-'}</TableCell>
                    <TableCell>{l.tax_rate ? `${l.tax_rate.name} (${l.tax_rate.rate}%)` : '-'}</TableCell>
                    <TableCell align="right" sx={{ color: l.debit > 0 ? '#2563EB' : 'text.disabled', fontWeight: l.debit > 0 ? 600 : 400 }}>
                      {l.debit > 0 ? money(l.debit, voucher.currency) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: l.credit > 0 ? '#16A34A' : 'text.disabled', fontWeight: l.credit > 0 ? 600 : 400 }}>
                      {l.credit > 0 ? money(l.credit, voucher.currency) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {money(runningBalances[i], voucher.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableBody>
                <TableRow sx={{ '& td': { fontWeight: 800, borderTop: '2px solid', borderColor: 'divider' } }}>
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell align="right" sx={{ color: '#2563EB' }}>{money(voucher.total_debit, voucher.currency)}</TableCell>
                  <TableCell align="right" sx={{ color: '#16A34A' }}>{money(voucher.total_credit, voucher.currency)}</TableCell>
                  <TableCell align="right">{money(runningBalances[runningBalances.length - 1] ?? 0, voucher.currency)}</TableCell>
                </TableRow>
                {!isBalanced && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ color: '#DC2626', fontWeight: 700 }}>Difference</TableCell>
                    <TableCell colSpan={2} align="right" sx={{ color: '#DC2626', fontWeight: 700 }}>
                      {money(Math.abs(voucher.total_debit - voucher.total_credit), voucher.currency)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </SectionCard>

        {/* TAX SUMMARY */}
        {(tax.rows.length > 0) && (
          <SectionCard title="Tax Summary" icon={TaxIcon} index={5}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, borderBottom: '2px solid', borderColor: 'divider' } }}>
                  <TableCell>Tax Code</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Taxable Amount</TableCell>
                  <TableCell align="right">Tax Amount (est.)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tax.rows.map((r) => (
                  <TableRow key={r.name + r.rate}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell align="right">{r.rate}%</TableCell>
                    <TableCell align="right">{money(r.taxable, voucher.currency)}</TableCell>
                    <TableCell align="right">{money(r.taxAmount, voucher.currency)}</TableCell>
                  </TableRow>
                ))}
                {tax.untaxedTotal > 0 && (
                  <TableRow>
                    <TableCell colSpan={2} sx={{ color: 'text.secondary' }}>Untagged</TableCell>
                    <TableCell align="right">{money(tax.untaxedTotal, voucher.currency)}</TableCell>
                    <TableCell align="right">—</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, maxWidth: 420, ml: 'auto', textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">Sub Total</Typography>
              <Box />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{money(tax.subTotal, voucher.currency)}</Typography>
              <Typography variant="body2" color="text.secondary">Tax Amount</Typography>
              <Box />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{money(tax.taxTotal, voucher.currency)}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>Grand Total</Typography>
              <Box />
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{money(tax.grandTotal, voucher.currency)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Tax amount is an informational estimate based on the rate tagged to each ledger line, not a separately posted amount.
            </Typography>
          </SectionCard>
        )}

        {/* APPROVAL WORKFLOW */}
        <SectionCard title="Approval Workflow" icon={TimelineIcon} index={6}>
          <Box sx={{ display: 'flex', overflowX: 'auto', gap: 0, alignItems: 'flex-start' }}>
            {approvalStages.map((stage, i) => (
              <React.Fragment key={stage.key}>
                <Box sx={{ minWidth: 140, textAlign: 'center' }}>
                  {stage.error ? (
                    <HighlightOff sx={{ color: '#DC2626', fontSize: 28 }} />
                  ) : stage.done ? (
                    <CheckCircleOutlined sx={{ color: '#16A34A', fontSize: 28 }} />
                  ) : (
                    <RadioButtonUnchecked sx={{ color: 'text.disabled', fontSize: 28 }} />
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>{stage.label}</Typography>
                  {stage.user && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{userName(stage.user)}</Typography>}
                  <Typography variant="caption" color="text.secondary">{stage.time ? fmtDateTime(stage.time) : (stage.skipped ? 'Skipped' : 'Pending')}</Typography>
                </Box>
                {i < approvalStages.length - 1 && (
                  <Box sx={{ flex: 1, height: '2px', bgcolor: stage.done ? '#16A34A' : 'divider', mt: 1.75, minWidth: 24 }} />
                )}
              </React.Fragment>
            ))}
          </Box>
          {voucher.remarks && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Remarks</Typography>
              <Typography variant="body2">{voucher.remarks}</Typography>
            </Box>
          )}
          {voucher.rejected_reason && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="error" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>Rejection Reason</Typography>
              <Typography variant="body2" color="error">{voucher.rejected_reason}</Typography>
            </Box>
          )}
        </SectionCard>

        {/* ATTACHMENTS */}
        <SectionCard title="Attachments" icon={AttachmentIcon} index={7}>
          {voucher.attachment_url ? (
            <Button size="small" variant="outlined" href={voucher.attachment_url} target="_blank" rel="noopener noreferrer">
              View Attachment
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">No attachments on this voucher.</Typography>
          )}
        </SectionCard>

        {/* RELATED RECORDS */}
        {relatedItems.length > 0 && (
          <SectionCard title="Related Records" icon={LinkIcon} index={8}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {relatedItems.map((item) => (
                <Chip
                  key={item.label}
                  label={item.label}
                  clickable
                  onClick={() => navigate(item.path)}
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>
          </SectionCard>
        )}
      </Box>

      <AuditTrailDrawer open={auditOpen} onClose={() => setAuditOpen(false)} entityId={voucher.id} />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, header, .MuiDrawer-root, .MuiAppBar-root { display: none !important; }
          body { background: #fff !important; }
          #voucher-print-area { padding: 0 !important; }
          #voucher-print-area .MuiPaper-root { border: 1px solid #E2E8F0 !important; box-shadow: none !important; break-inside: avoid; }
          @page { size: A4 portrait; margin: 16mm; }
          .print-watermark {
            display: block !important;
            position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 96px; font-weight: 800; color: rgba(15,23,42,0.06); letter-spacing: 8px;
            pointer-events: none; z-index: 0;
          }
        }
      `}</style>
    </Box>
  );
};

export default VoucherDetail;
