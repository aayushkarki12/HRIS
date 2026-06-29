import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/api';
import axios from 'axios';

interface LoginResult {
  success: boolean;
  error?: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  department?: string;
  position?: string;
  join_date?: string;
  tenant_subdomain?: string;
}

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (username: string, password: string, tenantId?: number) => Promise<LoginResult>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchTenant: (tenantId: number) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Load user from localStorage
    const storedUser = localStorage.getItem('user');
    const storedTenant = localStorage.getItem('tenant');
    
    console.log('AuthProvider - storedUser:', storedUser);
    console.log('AuthProvider - storedTenant:', storedTenant);
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        console.log('AuthProvider - user set:', parsedUser);
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
    
    if (storedTenant) {
      try {
        const parsedTenant = JSON.parse(storedTenant);
        setTenant(parsedTenant);
        console.log('AuthProvider - tenant set:', parsedTenant);
      } catch (e) {
        console.error('Error parsing tenant:', e);
      }
    }
    
    setLoading(false);
  }, []);

  const login = async (username: string, password: string, tenantId?: number): Promise<LoginResult> => {
    try {
      console.log('Login attempt with:', { username, tenantId });
      
      const response = await authService.login({ email: username, password, tenantId });
      console.log('Login response:', response);
      
      // Store user
      setUser(response.user);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Store tenant
      if (response.tenant) {
        setTenant(response.tenant);
        localStorage.setItem('tenant', JSON.stringify(response.tenant));
        console.log('Tenant stored:', response.tenant);
      } else {
        // If no tenant in response, try to get from localStorage
        const storedTenant = localStorage.getItem('tenant');
        if (storedTenant) {
          try {
            const parsedTenant = JSON.parse(storedTenant);
            setTenant(parsedTenant);
          } catch (e) {
            console.error('Error parsing stored tenant:', e);
          }
        }
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 422) {
          if (data.detail && Array.isArray(data.detail)) {
            errorMessage = data.detail.map((err: any) => err.msg).join(', ');
          } else if (data.detail) {
            errorMessage = data.detail;
          } else {
            errorMessage = 'Invalid credentials. Please check your username and password.';
          }
        } else if (status === 401) {
          errorMessage = 'Invalid credentials. Please check your username and password.';
        } else if (status === 404) {
          errorMessage = 'User not found. Please register first.';
        } else if (status === 400) {
          errorMessage = data.detail || 'Bad request. Please check your input.';
        } else {
          errorMessage = data.detail || 'An error occurred. Please try again.';
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your connection.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      
      const registrationData = {
        username: data.username,
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || '1234567890',
        department: data.department || 'General',
        position: data.position || 'Staff',
        join_date: data.join_date || new Date().toISOString().split('T')[0],
        tenant_subdomain: data.tenant_subdomain || 'default',
      };

      console.log('Registration data:', registrationData);
      
      const response = await axios.post(`${API_URL}/auth/register`, registrationData);
      
      if (response.status === 201 || response.status === 200) {
        return { success: true };
      }
      return { success: false, error: 'Registration failed. Please try again.' };
    } catch (error: any) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed. Please try again.';
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail.map((d: any) => d.msg).join(', ');
        }
      }
      return { success: false, error: errorMessage };
    }
  };

  const switchTenant = (tenantId: number): void => {
    const tenantData = { id: tenantId };
    localStorage.setItem('tenant', JSON.stringify(tenantData));
    setTenant(tenantData as Tenant);
    window.location.reload();
  };

  const logout = (): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    setUser(null);
    setTenant(null);
    delete localStorage.__tenant;
  };

  const isAuthenticated: boolean = !!user;
  const isAdmin: boolean = user?.role === 'admin';
  const isManager: boolean = user?.role === 'manager' || user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ 
      user, 
      tenant, 
      loading, 
      login, 
      register, 
      logout,
      switchTenant,
      isAuthenticated, 
      isAdmin,
      isManager 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Export useAuth hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};