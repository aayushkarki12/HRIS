import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components';
import {PrivateRoute} from './components';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Resources from './pages/Resources';
import Projects from './pages/Projects';
import Assignments from './pages/Assignments';
import Documents from './pages/document';
import Leaves from './pages/Leaves';
import Attendance from './pages/Attendance';
import Timesheets from './pages/Timesheets';
import TenantSettings from './pages/TenantSettings';
import Profile from './pages/profile';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntries from './pages/JournalEntries';
import GeneralLedger from './pages/GeneralLedger';
import Payroll from './pages/Payroll';
import ExpenseClaims from './pages/ExpenseClaims';
import Invoices from './pages/Invoices';
import FinancialReports from './pages/FinancialReports';
import Users from './pages/Users';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<PrivateRoute />}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="resources" element={<Resources />} />
            <Route path="projects" element={<Projects />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="documents" element={<Documents />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="timesheets" element={<Timesheets />} />
            <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="journal-entries" element={<JournalEntries />} />
            <Route path="general-ledger" element={<GeneralLedger />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="expense-claims" element={<ExpenseClaims />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="financial-reports" element={<FinancialReports />} />
            <Route path="users" element={<Users />} />
            <Route path="tenant-settings" element={<TenantSettings />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              style: {
                background: '#22c55e',
                color: '#fff',
              },
            },
            error: {
              duration: 4000,
              style: {
                background: '#ef4444',
                color: '#fff',
              },
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;