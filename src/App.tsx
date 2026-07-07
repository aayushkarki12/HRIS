import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components';
import { CommandPaletteProvider } from './components/common/CommandPalette';
import { PrivateRoute } from './components';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Resources from './pages/Resources';
import Projects from './pages/Projects';
import Assignments from './pages/Assignments';
import Documents from './pages/Document';
import Leaves from './pages/Leaves';
import Attendance from './pages/Attendance';
import Timesheets from './pages/Timesheets';
import TenantSettings from './pages/TenantSettings';
import Profile from './pages/profile';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntries from './pages/JournalEntries';
import GeneralLedger from './pages/GeneralLedger';
import Payroll from './pages/Payroll';
import AccountingDashboard from './pages/AccountingDashboard';
import ExpenseClaims from './pages/ExpenseClaims';
import Invoices from './pages/Invoices';
import FinancialReports from './pages/FinancialReports';
import Users from './pages/Users';
import Vouchers from './pages/Vouchers';
import VoucherForm from './pages/VoucherForm';
import VoucherDetail from './pages/VoucherDetail';
import CostCentersTax from './pages/CostCentersTax';
import LedgerGroups from './pages/LedgerGroups';
import AuditTrail from './pages/AuditTrail';
import InventorySetup from './pages/InventorySetup';
import Items from './pages/Items';
import StockLedger from './pages/StockLedger';
import BankReconciliation from './pages/BankReconciliation';
import Budgets from './pages/Budgets';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CommandPaletteProvider>
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
            <Route path="accounting-dashboard" element={<AccountingDashboard />} />
            <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
            <Route path="ledger-groups" element={<LedgerGroups />} />
            <Route path="audit-trail" element={<AuditTrail />} />
            <Route path="inventory-setup" element={<InventorySetup />} />
            <Route path="items" element={<Items />} />
            <Route path="stock-ledger" element={<StockLedger />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="vouchers" element={<Vouchers />} />
            <Route path="vouchers/new" element={<VoucherForm />} />
            <Route path="vouchers/:id" element={<VoucherDetail />} />
            <Route path="journal-entries" element={<JournalEntries />} />
            <Route path="general-ledger" element={<GeneralLedger />} />
            <Route path="cost-centers" element={<CostCentersTax />} />
            <Route path="bank-reconciliation" element={<BankReconciliation />} />
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
