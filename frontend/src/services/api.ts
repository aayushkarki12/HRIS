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

api.interceptors.response.use(
  (response) => {
    console.log('Response:', {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
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

  logout: (): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
  },

  getCurrentUser: (): any => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
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

// ============ TENANT SERVICE ============
export const tenantService = {
  getMyTenant: async () => {
    const response = await api.get('/tenants/me');
    return response.data;
  },

  updateMyTenant: async (data: any) => {
    const response = await api.put('/tenants/me', data);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/tenants/me/stats');
    return response.data;
  },
};



export default api;