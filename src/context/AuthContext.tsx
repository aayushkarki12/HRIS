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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = authService.getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      console.log('Login attempt with:', { username });
      
      const response = await authService.login({ email: username, password });
      console.log('Login response:', response);
      
      setUser(response.user);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        console.log('Error response:', { status, data });
        
        if (status === 422) {
          // Validation error - extract details
          if (data.detail && Array.isArray(data.detail)) {
            errorMessage = data.detail.map((err: any) => 
              `${err.loc?.join('.') || 'field'}: ${err.msg}`
            ).join(', ');
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

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};