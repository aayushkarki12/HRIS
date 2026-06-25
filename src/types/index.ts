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
  join_date: string;
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
  join_date: string;
}

export interface EmployeeUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  join_date?: string;
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