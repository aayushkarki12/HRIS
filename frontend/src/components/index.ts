import ErrorBoundary from "./ErrorBoundary";
import PrivateRoute from "./common/PrivateRoute";

export { ErrorBoundary, PrivateRoute };

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user' | 'manager';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: number;
  employee_id: string;  // Changed from separate firstName/lastName
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

export interface Resource {
  id: number;
  name: string;
  type: 'laptop' | 'monitor' | 'keyboard' | 'mouse' | 'other';
  serial_number: string;  // Changed from serialNumber
  status: 'available' | 'assigned' | 'maintenance';
  assigned_to?: number;
  assigned_to_employee?: Employee;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  start_date: string;  // Changed from startDate
  end_date?: string;   // Changed from endDate
  budget: number;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: number;
  employee_id: number;
  resource_id: number;
  project_id: number;
  assigned_date: string;  // Changed from assignedDate
  return_date?: string;   // Changed from returnDate
  status: 'active' | 'returned';
  employee?: Employee;
  resource?: Resource;
  project?: Project;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ApiError {
  detail: string;
}

