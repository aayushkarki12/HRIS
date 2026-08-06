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
  role_id?: number | null;
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
  seniority_level_id?: number | null;
  // "full_time" | "probation" - probation employees get a reduced leave
  // allocation, see HRIS_backend app/api/v1/leave.py::PROBATION_LEAVE_RATIO.
  employment_type?: 'full_time' | 'probation' | 'contractor';
  // Drives clock-in/out rules, see HRIS_backend app/api/v1/attendance.py.
  attendance_type?: 'fixed' | 'individual' | 'contractor';
  assigned_work_location_id?: number | null;
  fixed_clock_in_time?: string | null;
  fixed_clock_out_time?: string | null;
  invite_status?: 'invited' | 'expired' | 'accepted' | null;
  projects?: string[];
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
  seniority_level_id?: number | null;
  employment_type?: 'full_time' | 'probation' | 'contractor';
  // Not a stored field - only controls the timestamp of the resulting
  // career_change audit-log entry on the backend (see EmployeeUpdate in
  // HRIS_backend app/schemas/employee.py). Omit for "now".
  effective_date?: string;
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