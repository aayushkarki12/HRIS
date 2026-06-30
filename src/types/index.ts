export interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  office_latitude?: number | null;
  office_longitude?: number | null;
  office_radius?: number | null;
  office_address?: string | null;
}
// Update AuthResponse to include tenant
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  tenant?: Tenant;
}

// Update LoginCredentials to include tenant
export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: number;
}
// User Types
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username?: string;
  role: 'admin' | 'user' | 'manager';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Employee Types
export interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  joining_date: string;
  is_active: boolean;
  user_id: number;
  user?: User;
  created_at: string;
  updated_at: string;
}

// Resource Types
export interface Resource {
  id: number;
  name: string;
  type: 'laptop' | 'monitor' | 'keyboard' | 'mouse' | 'other';
  serial_number: string;
  status: 'available' | 'assigned' | 'maintenance' | 'repair';
  assigned_to?: number;
  assigned_to_employee?: Employee;
  created_at: string;
  updated_at: string;
}

// Project Types
export interface Project {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold' | 'planning' | 'cancelled';
  start_date: string;
  end_date?: string;
  budget: number;
  created_at: string;
  updated_at: string;
}

// Assignment Types
export interface Assignment {
  id: number;
  employee_id: number;
  resource_id: number;
  project_id: number;
  assigned_date: string;
  return_date?: string;
  status: 'active' | 'returned' | 'overdue';
  employee?: Employee;
  resource?: Resource;
  project?: Project;
  created_at: string;
  updated_at: string;
}

// Auth Types
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface ApiError {
  detail: string;
  status?: number;
}

// Request/Response Types for CRUD operations
export interface EmployeeCreate {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  joining_date: string;
}

export interface EmployeeUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  joining_date?: string;
  is_active?: boolean;
}

export interface ResourceCreate {
  name: string;
  type: string;
  serial_number: string;
  status: string;
}

export interface ResourceUpdate {
  name?: string;
  type?: string;
  serial_number?: string;
  status?: string;
  assigned_to?: number | null;
}

export interface ProjectCreate {
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date?: string;
  budget: number;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
}

export interface AssignmentCreate {
  employee_id: number;
  resource_id: number;
  project_id: number;
  assigned_date?: string;
}

export interface AssignmentUpdate {
  return_date?: string;
  status?: string;
}

// Pagination Types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

// Dashboard Stats Types
export interface DashboardStats {
  total_employees: number;
  total_resources: number;
  total_projects: number;
  active_employees: number;
  available_resources: number;
  assigned_resources: number;
  active_assignments: number;
}

// Filter Types
export interface EmployeeFilters {
  department?: string;
  is_active?: boolean;
  search?: string;
}

export interface ResourceFilters {
  type?: string;
  status?: string;
  search?: string;
}

export interface ProjectFilters {
  status?: string;
  search?: string;
}

export interface AssignmentFilters {
  status?: string;
  employee_id?: number;
  project_id?: number;
}

// Component Prop Types
export interface SelectOption {
  value: string | number;
  label: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

// Context Types
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

// Route Types
export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  children?: RouteConfig[];
  requiresAuth?: boolean;
  requiredRole?: 'admin' | 'manager' | 'user';
}

// Utility Types
export type ApiResponse<T> = {
  data: T;
  message?: string;
  status: number;
};

export type ErrorResponse = {
  detail: string;
  errors?: Record<string, string[]>;
};

// Accounting Types
export interface Account {
  id: number;
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  parent_id?: number | null;
  description?: string;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at?: string;
}

export interface AccountCreate {
  code: string;
  name: string;
  account_type: string;
  parent_id?: number | null;
  description?: string;
}

export interface AccountUpdate {
  code?: string;
  name?: string;
  account_type?: string;
  parent_id?: number | null;
  description?: string;
  is_active?: boolean;
}

// Journal Entry Types
export interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_id: number;
  description?: string;
  debit: number;
  credit: number;
  tenant_id: number;
  account?: Account;
  created_at: string;
  updated_at?: string;
}

export interface JournalEntryLineCreate {
  account_id: number;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: number;
  entry_number: string;
  date: string;
  description: string;
  reference?: string;
  reference_type?: 'manual' | 'payroll' | 'expense' | 'invoice';
  status: 'draft' | 'posted';
  posted_by?: number;
  posted_at?: string;
  tenant_id: number;
  lines: JournalEntryLine[];
  created_at: string;
  updated_at?: string;
}

export interface JournalEntryCreate {
  date: string;
  description: string;
  reference?: string;
  reference_type?: string;
  lines: JournalEntryLineCreate[];
}

// General Ledger Types
export interface LedgerLine {
  id: number;
  date: string;
  entry_number: string;
  journal_entry_id: number;
  description?: string;
  entry_description: string;
  reference?: string;
  debit: number;
  credit: number;
  running_balance: number;
}

export interface LedgerAccount {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  lines: LedgerLine[];
}

// Payroll Types
export interface SalaryStructure {
  id: number;
  employee_id: number;
  base_salary: number;
  currency: string;
  effective_date: string;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at?: string;
}

export interface PayslipLine {
  id: number;
  payslip_id: number;
  line_type: 'earning' | 'deduction';
  description: string;
  amount: number;
  tenant_id: number;
  created_at: string;
}

export interface Payslip {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  base_salary: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  working_days: number;
  leave_days: number;
  overtime_hours: number;
  tenant_id: number;
  lines: PayslipLine[];
  created_at: string;
}

export interface PayrollRun {
  id: number;
  period_start: string;
  period_end: string;
  status: 'draft' | 'processed' | 'paid';
  processed_by?: number;
  processed_at?: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  journal_entry_id?: number;
  tenant_id: number;
  payslips: Payslip[];
  created_at: string;
}

// Expense Claim Types
export interface ExpenseClaimLine {
  id: number;
  expense_claim_id: number;
  description: string;
  amount: number;
  category: string;
  receipt_url?: string;
  tenant_id: number;
  created_at: string;
}

export interface ExpenseClaim {
  id: number;
  claim_number: string;
  employee_id: number;
  date: string;
  description: string;
  total_amount: number;
  status: 'draft' | 'submitted' | 'manager_approved' | 'accounting_approved' | 'paid' | 'rejected';
  submitted_at?: string;
  manager_approved_by?: number;
  manager_approved_at?: string;
  accounting_approved_by?: number;
  accounting_approved_at?: string;
  rejected_by?: number;
  rejected_at?: string;
  rejection_reason?: string;
  paid_at?: string;
  journal_entry_id?: number;
  tenant_id: number;
  lines: ExpenseClaimLine[];
  created_at: string;
}

// Invoice Types
export interface InvoiceLine {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tenant_id: number;
  created_at: string;
}

export interface InvoicePayment {
  id: number;
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
  journal_entry_id?: number;
  tenant_id: number;
  created_at: string;
}

export interface CustomerInvoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_email?: string;
  project_id?: number;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  journal_entry_id?: number;
  tenant_id: number;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  created_at: string;
}

// Work Location Types
export interface WorkLocation {
  id: number;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at?: string;
}

export interface WorkLocationCreate {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius: number;
}

// Enum Types
export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
}

export enum ResourceStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  MAINTENANCE = 'maintenance',
  REPAIR = 'repair',
}

export enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ON_HOLD = 'on-hold',
  PLANNING = 'planning',
  CANCELLED = 'cancelled',
}

export enum AssignmentStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
}

export enum ResourceType {
  LAPTOP = 'laptop',
  MONITOR = 'monitor',
  KEYBOARD = 'keyboard',
  MOUSE = 'mouse',
  OTHER = 'other',
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}