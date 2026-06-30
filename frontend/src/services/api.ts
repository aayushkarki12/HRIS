import axios, { type AxiosInstance, AxiosError } from 'axios';
import { LoginCredentials, AuthResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get tenant from localStorage
const getTenantId = (): string => {
  const tenant = localStorage.getItem('tenant');
  if (tenant) {
    try {
      const parsed = JSON.parse(tenant);
      return parsed.id || '1';
    } catch (e) {
      return '1';
    }
  }
  return '1';
};

// Add token and tenant to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add tenant header for multi-tenancy
    config.headers['X-Tenant-ID'] = getTenantId();
    
    console.log('Request:', {
      url: config.url,
      method: config.method,
      tenant: config.headers['X-Tenant-ID'],
      auth: token ? 'Bearer ***' : 'No token',
    });
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const clearSession = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('tenant');
};

// Concurrent requests that all 401 at once should trigger exactly one refresh
// call, not one each - this dedupes them onto a single in-flight promise.
let refreshPromise: Promise<string | null> | null = null;

const attemptTokenRefresh = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => {
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('refresh_token', res.data.refresh_token);
        return res.data.access_token as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => {
    console.log('Response:', {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  async (error: AxiosError) => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    const originalRequest = error.config as (typeof error.config & { _retried?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      const newAccessToken = await attemptTokenRefresh();
      if (newAccessToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      }
      clearSession();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============ AUTH SERVICE ============
export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', credentials.email);
      formData.append('password', credentials.password);

      if (credentials.tenantId) {
        formData.append('tenant_id', String(credentials.tenantId));
      }

      const response = await api.post<AuthResponse>('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      } catch {
        // Best-effort - clear local session regardless of whether the server call succeeds.
      }
    }
    clearSession();
  },

  getCurrentUser: (): any => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

// ============ USER SERVICE (admin: role & account management) ============
export const userService = {
  getAll: async (search?: string) => {
    const response = await api.get('/users/', { params: { search } });
    return response.data;
  },

  updateRole: async (id: number, role: 'admin' | 'manager' | 'user') => {
    const response = await api.put(`/users/${id}`, { role });
    return response.data;
  },

  activate: async (id: number) => {
    const response = await api.patch(`/users/${id}/activate`);
    return response.data;
  },

  deactivate: async (id: number) => {
    const response = await api.patch(`/users/${id}/deactivate`);
    return response.data;
  },
};

// ============ EMPLOYEE SERVICE ============
export const employeeService = {
  getAll: async () => {
    try {
      const response = await api.get('/employees', {
        params: {
          skip: 0,
          limit: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  },

  getById: async (id: number) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  getMyProfile: async () => {
    const response = await api.get('/employees/me');
    return response.data;
  },

  updateMyProfile: async (data: any) => {
    const response = await api.put('/employees/me', data);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/employees/stats');
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/employees', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/employees/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },
};

// ============ RESOURCE SERVICE ============
export const resourceService = {
  getAll: async () => {
    try {
      const response = await api.get('/resources', {
        params: {
          skip: 0,
          limit: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching resources:', error);
      throw error;
    }
  },

  getAvailable: async () => {
    const response = await api.get('/resources/available');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/resources/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/resources', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/resources/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/resources/${id}`);
    return response.data;
  },
};

// ============ PROJECT SERVICE ============
export const projectService = {
  getAll: async () => {
    try {
      const response = await api.get('/projects', {
        params: {
          skip: 0,
          limit: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  getById: async (id: number) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/projects', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },
};

// ============ ASSIGNMENT SERVICE ============
export const assignmentService = {
  getAll: async () => {
    try {
      const response = await api.get('/assignments', {
        params: {
          skip: 0,
          limit: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  },

  getById: async (id: number) => {
    const response = await api.get(`/assignments/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/assignments', data);
    return response.data;
  },

  return: async (id: number) => {
    const response = await api.put(`/assignments/${id}/return`);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/assignments/${id}`);
    return response.data;
  },
};

// ============ DOCUMENT SERVICE ============
export const documentService = {
  getMyDocuments: async () => {
    const response = await api.get('/documents/my');
    return response.data;
  },

  upload: async (file: File, documentType: string, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/documents/upload', formData, {
      params: {
        document_type: documentType,
        description: description || '',
      },
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  verify: async (id: number) => {
    const response = await api.put(`/documents/${id}/verify`);
    return response.data;
  },
};

// ============ LEAVE SERVICE ============
export const leaveService = {
  getTypes: async () => {
    const response = await api.get('/leaves/types');
    return response.data;
  },

  getMyLeaves: async () => {
    const response = await api.get('/leaves/my');
    return response.data;
  },

  getPending: async () => {
    const response = await api.get('/leaves/pending');
    return response.data;
  },

  getBalance: async () => {
    const response = await api.get('/leaves/balances/my');
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/leaves', data);
    return response.data;
  },

  approve: async (id: number) => {
    const response = await api.put(`/leaves/${id}/approve`);
    return response.data;
  },

  reject: async (id: number, reason?: string) => {
    const response = await api.put(`/leaves/${id}/reject`, null, {
      params: { reason },
    });
    return response.data;
  },

  cancel: async (id: number) => {
    const response = await api.put(`/leaves/${id}/cancel`);
    return response.data;
  },

  calculateBalances: async (year: number) => {
    const response = await api.post('/leaves/balances/calculate', null, {
      params: { year },
    });
    return response.data;
  },
};

// ============ ATTENDANCE SERVICE ============
export const attendanceService = {
  getMyAttendance: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/attendance/my', {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
    return response.data;
  },

  clockIn: async (latitude?: number, longitude?: number) => {
    const response = await api.post('/attendance/clock-in', null, {
      params: {
        latitude: latitude,
        longitude: longitude,
      },
    });
    return response.data;
  },

  clockOut: async (latitude?: number, longitude?: number) => {
    const response = await api.post('/attendance/clock-out', null, {
      params: {
        latitude: latitude,
        longitude: longitude,
      },
    });
    return response.data;
  },

  startBreak: async (breakType: string) => {
    const response = await api.post('/attendance/break/start', null, {
      params: { break_type: breakType },
    });
    return response.data;
  },

  endBreak: async () => {
    const response = await api.post('/attendance/break/end');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/attendance/stats');
    return response.data;
  },
};

// ============ WORK LOCATION SERVICE ============
export const workLocationService = {
  getAll: async () => {
    const response = await api.get('/work-locations/');
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/work-locations/', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.put(`/work-locations/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/work-locations/${id}`);
    return response.data;
  },
};

// ============ TIMESHEET SERVICE ============
export const timesheetService = {
  getMyTimesheets: async () => {
    const response = await api.get('/timesheets/my');
    return response.data;
  },

  create: async (data: any) => {
    // Remove trailing slash if any
    const response = await api.post('/timesheets', data);
    return response.data;
  },

  addEntry: async (timesheetId: number, data: any) => {
    const response = await api.post(`/timesheets/${timesheetId}/entries`, data);
    return response.data;
  },

  updateEntry: async (timesheetId: number, entryId: number, data: any) => {
    const response = await api.put(`/timesheets/${timesheetId}/entries/${entryId}`, data);
    return response.data;
  },

  deleteEntry: async (timesheetId: number, entryId: number) => {
    const response = await api.delete(`/timesheets/${timesheetId}/entries/${entryId}`);
    return response.data;
  },

  submit: async (timesheetId: number) => {
    const response = await api.put(`/timesheets/${timesheetId}/submit`);
    return response.data;
  },

  approve: async (timesheetId: number) => {
    const response = await api.put(`/timesheets/${timesheetId}/approve`);
    return response.data;
  },

  getStats: async (weekStart?: string) => {
    const response = await api.get('/timesheets/stats', {
      params: { week_start: weekStart },
    });
    return response.data;
  },
};

// ============ ACCOUNTING SERVICE ============
export const accountingService = {
  getAccounts: async (params?: { account_type?: string; search?: string; is_active?: boolean }) => {
    const response = await api.get('/accounting/accounts', { params });
    return response.data;
  },

  getAccountTree: async () => {
    const response = await api.get('/accounting/accounts/tree');
    return response.data;
  },

  getAccountTypes: async () => {
    const response = await api.get('/accounting/accounts/types');
    return response.data;
  },

  getAccountById: async (id: number) => {
    const response = await api.get(`/accounting/accounts/${id}`);
    return response.data;
  },

  createAccount: async (data: any) => {
    const response = await api.post('/accounting/accounts', data);
    return response.data;
  },

  updateAccount: async (id: number, data: any) => {
    const response = await api.put(`/accounting/accounts/${id}`, data);
    return response.data;
  },

  deleteAccount: async (id: number) => {
    const response = await api.delete(`/accounting/accounts/${id}`);
    return response.data;
  },

  // Journal Entries
  getJournalEntries: async (params?: { status?: string; reference_type?: string; start_date?: string; end_date?: string }) => {
    const response = await api.get('/accounting/journal-entries', { params });
    return response.data;
  },

  getJournalEntryById: async (id: number) => {
    const response = await api.get(`/accounting/journal-entries/${id}`);
    return response.data;
  },

  createJournalEntry: async (data: any) => {
    const response = await api.post('/accounting/journal-entries', data);
    return response.data;
  },

  updateJournalEntry: async (id: number, data: any) => {
    const response = await api.put(`/accounting/journal-entries/${id}`, data);
    return response.data;
  },

  postJournalEntry: async (id: number) => {
    const response = await api.put(`/accounting/journal-entries/${id}/post`);
    return response.data;
  },

  deleteJournalEntry: async (id: number) => {
    const response = await api.delete(`/accounting/journal-entries/${id}`);
    return response.data;
  },

  // General Ledger
  getLedger: async (params?: { start_date?: string; end_date?: string; account_id?: number; account_type?: string }) => {
    const response = await api.get('/accounting/ledger', { params });
    return response.data;
  },

  getLedgerSummary: async (params?: { start_date?: string; end_date?: string }) => {
    const response = await api.get('/accounting/ledger/summary', { params });
    return response.data;
  },

  // Financial Reports
  getTrialBalance: async (params?: { start_date?: string; end_date?: string }) => {
    const response = await api.get('/accounting/reports/trial-balance', { params });
    return response.data;
  },

  getIncomeStatement: async (params?: { start_date?: string; end_date?: string }) => {
    const response = await api.get('/accounting/reports/income-statement', { params });
    return response.data;
  },

  getBalanceSheet: async (params?: { end_date?: string }) => {
    const response = await api.get('/accounting/reports/balance-sheet', { params });
    return response.data;
  },

  getCashFlow: async (params?: { start_date?: string; end_date?: string }) => {
    const response = await api.get('/accounting/reports/cash-flow', { params });
    return response.data;
  },
};

// ============ PAYROLL SERVICE ============
export const payrollService = {
  getSalaryStructures: async (employeeId?: number) => {
    const response = await api.get('/payroll/salary-structures', {
      params: employeeId ? { employee_id: employeeId } : undefined,
    });
    return response.data;
  },

  createSalaryStructure: async (data: any) => {
    const response = await api.post('/payroll/salary-structures', data);
    return response.data;
  },

  updateSalaryStructure: async (id: number, data: any) => {
    const response = await api.put(`/payroll/salary-structures/${id}`, data);
    return response.data;
  },

  getPayrollRuns: async () => {
    const response = await api.get('/payroll/runs');
    return response.data;
  },

  getPayrollRun: async (id: number) => {
    const response = await api.get(`/payroll/runs/${id}`);
    return response.data;
  },

  createPayrollRun: async (data: any) => {
    const response = await api.post('/payroll/runs', data);
    return response.data;
  },

  processPayrollRun: async (id: number) => {
    const response = await api.put(`/payroll/runs/${id}/process`);
    return response.data;
  },

  deletePayrollRun: async (id: number) => {
    const response = await api.delete(`/payroll/runs/${id}`);
    return response.data;
  },

  getMyPayslips: async () => {
    const response = await api.get('/payroll/my-payslips');
    return response.data;
  },
};

// ============ EXPENSE SERVICE ============
export const expenseService = {
  getAll: async (params?: { status?: string }) => {
    const response = await api.get('/expenses', { params });
    return response.data;
  },

  getMyExpenses: async () => {
    const response = await api.get('/expenses/my');
    return response.data;
  },

  getPending: async () => {
    const response = await api.get('/expenses/pending');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/expenses', data);
    return response.data;
  },

  submit: async (id: number) => {
    const response = await api.put(`/expenses/${id}/submit`);
    return response.data;
  },

  managerApprove: async (id: number) => {
    const response = await api.put(`/expenses/${id}/manager-approve`);
    return response.data;
  },

  accountingApprove: async (id: number) => {
    const response = await api.put(`/expenses/${id}/accounting-approve`);
    return response.data;
  },

  pay: async (id: number) => {
    const response = await api.put(`/expenses/${id}/pay`);
    return response.data;
  },

  reject: async (id: number, reason?: string) => {
    const response = await api.put(`/expenses/${id}/reject`, null, { params: { reason } });
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/expenses/${id}`);
    return response.data;
  },
};

// ============ INVOICE SERVICE ============
export const invoiceService = {
  getAll: async (params?: { status?: string }) => {
    const response = await api.get('/invoices/', { params });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/invoices/stats');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/invoices/', data);
    return response.data;
  },

  send: async (id: number) => {
    const response = await api.put(`/invoices/${id}/send`);
    return response.data;
  },

  recordPayment: async (id: number, data: any) => {
    const response = await api.post(`/invoices/${id}/payments`, data);
    return response.data;
  },

  cancel: async (id: number) => {
    const response = await api.put(`/invoices/${id}/cancel`);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/invoices/${id}`);
    return response.data;
  },
};

// ============ TENANT SERVICE ============
export const tenantService = {
  getMyTenant: async () => {
    const response = await api.get('/tenants/me');
    return response.data;
  },

 updateMyTenant: async (data: any) => {
  // Get tenant ID from localStorage or context
  const tenantStr = localStorage.getItem('tenant');
  const tenant = tenantStr ? JSON.parse(tenantStr) : null;
  const tenantId = tenant?.id;
  
  if (!tenantId) {
    throw new Error('Tenant ID not found');
  }
  
  const response = await api.put(`/tenants/${tenantId}`, data);
  return response.data;
},

  getStats: async () => {
    const response = await api.get('/tenants/me/stats');
    return response.data;
  },
};



export default api;