import {
  Payments as PaymentIcon,
  AccountBalanceWallet as ReceiptIcon,
  SwapHoriz as ContraIcon,
  MenuBook as JournalIcon,
  PointOfSale as SalesIcon,
  ShoppingCart as PurchaseIcon,
  Undo as DebitNoteIcon,
  Redo as CreditNoteIcon,
} from '@mui/icons-material';

export const VOUCHER_TYPES = [
  { value: 'payment', label: 'Payment Voucher', short: 'Payment', icon: PaymentIcon, color: '#DC2626', hint: 'Money going out — debit the party/expense, credit cash/bank' },
  { value: 'receipt', label: 'Receipt Voucher', short: 'Receipt', icon: ReceiptIcon, color: '#16A34A', hint: 'Money coming in — debit cash/bank, credit the party/income' },
  { value: 'contra', label: 'Contra Voucher', short: 'Contra', icon: ContraIcon, color: '#0891B2', hint: 'Transfer between your own cash/bank accounts' },
  { value: 'journal', label: 'Journal Voucher', short: 'Journal', icon: JournalIcon, color: '#7C3AED', hint: 'Any non-cash adjustment entry' },
  { value: 'sales', label: 'Sales Voucher', short: 'Sales', icon: SalesIcon, color: '#4F46E5', hint: 'Goods/services sold on credit or cash' },
  { value: 'purchase', label: 'Purchase Voucher', short: 'Purchase', icon: PurchaseIcon, color: '#D97706', hint: 'Goods/services purchased on credit or cash' },
  { value: 'debit_note', label: 'Debit Note', short: 'Debit Note', icon: DebitNoteIcon, color: '#B45309', hint: 'Reduce an amount owed to a supplier (purchase return)' },
  { value: 'credit_note', label: 'Credit Note', short: 'Credit Note', icon: CreditNoteIcon, color: '#0E7490', hint: 'Reduce an amount owed by a customer (sales return)' },
] as const;

export const voucherMeta = (type: string) => VOUCHER_TYPES.find(v => v.value === type) ?? VOUCHER_TYPES[3];

export const STATUS_META: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'; bg: string; fg: string }> = {
  draft:     { label: 'Draft',     color: 'default', bg: '#F1F5F9', fg: '#475569' },
  submitted: { label: 'Submitted', color: 'info',    bg: '#EFF6FF', fg: '#2563EB' },
  approved:  { label: 'Approved',  color: 'secondary', bg: '#F5F3FF', fg: '#7C3AED' },
  rejected:  { label: 'Rejected',  color: 'error',   bg: '#FEF2F2', fg: '#DC2626' },
  cancelled: { label: 'Cancelled', color: 'default', bg: '#F1F5F9', fg: '#94A3B8' },
  posted:    { label: 'Posted',    color: 'success', bg: '#F0FDF4', fg: '#16A34A' },
};

export const PARTY_LABELS: Record<string, { partyLabel: string; showPaymentMethod: boolean; showDueDate: boolean }> = {
  payment: { partyLabel: 'Payee', showPaymentMethod: true, showDueDate: false },
  receipt: { partyLabel: 'Received From', showPaymentMethod: true, showDueDate: false },
  contra: { partyLabel: 'Transfer Between', showPaymentMethod: false, showDueDate: false },
  journal: { partyLabel: 'Party (optional)', showPaymentMethod: false, showDueDate: false },
  sales: { partyLabel: 'Customer', showPaymentMethod: false, showDueDate: true },
  purchase: { partyLabel: 'Vendor', showPaymentMethod: false, showDueDate: true },
  credit_note: { partyLabel: 'Customer', showPaymentMethod: false, showDueDate: false },
  debit_note: { partyLabel: 'Vendor', showPaymentMethod: false, showDueDate: false },
};

export const money = (n: number, currency = 'USD') =>
  `${currency === 'USD' ? '$' : currency + ' '}${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const userName = (u: any) =>
  u ? (`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.username) : '—';

// Fiscal year label derived from the voucher date using an April–March cycle (common ERP convention).
// Not sourced from a tenant setting since none exists in the data model yet.
export const fiscalYear = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth(); // 0 = Jan
  const startYear = m >= 3 ? y : y - 1; // April onward starts the FY
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

export const RELATED_SOURCE_LABELS: Record<string, { label: string; path: string }> = {
  expense_claim: { label: 'Expense Claim', path: '/expense-claims' },
  invoice: { label: 'Invoice', path: '/invoices' },
  payroll_run: { label: 'Payroll Run', path: '/payroll' },
  manual: { label: 'Manual Entry', path: '' },
};

// Groups journal entry lines by tax code for a summary panel. This reports the tagged
// amount and nominal rate per code — it does NOT invent a tax computation the ledger
// lines don't already represent, since tax_rate is a reporting tag, not a separate
// tax-amount field on JournalEntryLine.
export const taxBreakdown = (lines: any[], currency = 'USD') => {
  const groups = new Map<string, { name: string; rate: number; taxable: number; taxAmount: number }>();
  let untaxedTotal = 0;
  for (const l of lines) {
    const amt = Number(l.debit) || 0;
    if (amt <= 0) continue; // tax summary is expressed against the debit (expense/asset) side
    if (!l.tax_rate) { untaxedTotal += amt; continue; }
    const key = `${l.tax_rate.name}-${l.tax_rate.rate}`;
    const existing = groups.get(key);
    const taxAmount = amt * (Number(l.tax_rate.rate) || 0) / 100;
    if (existing) {
      existing.taxable += amt;
      existing.taxAmount += taxAmount;
    } else {
      groups.set(key, { name: l.tax_rate.name, rate: Number(l.tax_rate.rate) || 0, taxable: amt, taxAmount });
    }
  }
  const rows = Array.from(groups.values());
  const taxableTotal = rows.reduce((s, r) => s + r.taxable, 0) + untaxedTotal;
  const taxTotal = rows.reduce((s, r) => s + r.taxAmount, 0);
  return { rows, untaxedTotal, subTotal: taxableTotal, taxTotal, grandTotal: taxableTotal + taxTotal, currency };
};
