import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components';
import { CommandPaletteProvider } from './components/common/CommandPalette';
import { PrivateRoute, RequireRole } from './components';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvitation from './pages/AcceptInvitation';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Resources from './pages/Resources';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Assignments from './pages/Assignments';
import Leaves from './pages/Leaves';
import Attendance from './pages/Attendance';
import Timesheets from './pages/Timesheets';
import TenantSettings from './pages/TenantSettings';
import Profile from './pages/profile';
import Users from './pages/Users';
import RolesPermissions from './pages/RolesPermissions';
import AuditTrail from './pages/AuditTrail';
import InventorySetup from './pages/InventorySetup';
import Items from './pages/Items';
import StockLedger from './pages/StockLedger';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CommandPaletteProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/invitation" element={<AcceptInvitation />} />
          <Route path="/" element={<PrivateRoute />}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/:id" element={<EmployeeDetail />} />
            <Route path="resources" element={<Resources />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="assignments" element={<Assignments />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="timesheets" element={<Timesheets />} />
            <Route path="audit-trail" element={<RequireRole role="manager"><AuditTrail /></RequireRole>} />
            <Route path="inventory-setup" element={<RequireRole role="manager"><InventorySetup /></RequireRole>} />
            <Route path="items" element={<RequireRole role="manager"><Items /></RequireRole>} />
            <Route path="stock-ledger" element={<RequireRole role="manager"><StockLedger /></RequireRole>} />
            <Route path="users" element={<RequireRole role="admin"><Users /></RequireRole>} />
            <Route path="roles-permissions" element={<RequireRole role="admin"><RolesPermissions /></RequireRole>} />
            <Route path="tenant-settings" element={<RequireRole role="admin"><TenantSettings /></RequireRole>} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>

        {/* Enterprise-styled toasts — light, bordered, on-brand */}
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              boxShadow: '0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04)',
              fontSize: '0.875rem',
              fontFamily: '"Inter", system-ui, sans-serif',
              fontWeight: 400,
              padding: '10px 14px',
              maxWidth: '380px',
              lineHeight: 1.5,
            },
            success: {
              duration: 3000,
              style: {
                background: '#F0FDF4',
                color: '#14532D',
                border: '1px solid #BBF7D0',
              },
              iconTheme: { primary: '#16A34A', secondary: '#F0FDF4' },
            },
            error: {
              duration: 4500,
              style: {
                background: '#FEF2F2',
                color: '#7F1D1D',
                border: '1px solid #FECACA',
              },
              iconTheme: { primary: '#DC2626', secondary: '#FEF2F2' },
            },
          }}
        />
        </CommandPaletteProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
