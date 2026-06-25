import axios, { type AxiosInstance, AxiosError } from 'axios';
import { LoginCredentials, AuthResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    console.log('Request interceptor - Token:', token ? 'Exists' : 'Not found');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Authorization header set:', config.headers.Authorization);
    } else {
      console.warn('No token found in localStorage');
    }
    console.log('Request config:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });
    
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', credentials.email);
      formData.append('password', credentials.password);
      
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
    delete api.defaults.headers.common['Authorization'];
  },

  getCurrentUser: (): any => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

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

export const assignmentService = {
  getAll: async () => {
    try {
      const response = await api.get('/assignments');
      return response.data;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  },
  create: async (data: any) => {
    try {
      console.log('Creating assignment with data:', data);
      const response = await api.post('/assignments', data);
      console.log('Create assignment response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw error;
    }
  },
  return: async (id: number) => {
    try {
      const response = await api.put(`/assignments/${id}/return`);
      return response.data;
    } catch (error) {
      console.error('Error returning assignment:', error);
      throw error;
    }
  },
  delete: async (id: number) => {
    try {
      const response = await api.delete(`/assignments/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting assignment:', error);
      throw error;
    }
  },
};