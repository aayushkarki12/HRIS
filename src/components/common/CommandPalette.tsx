import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, InputBase, Divider } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  BeachAccess as LeaveIcon,
  AccessTime as AttendanceIcon,
  TimerOutlined as TimesheetIcon,
  Payments as PayrollIcon,
  Folder as ProjectIcon,
  Computer as ResourceIcon,
  Assignment as AssignmentIcon,
  Receipt as ExpenseIcon,
  DescriptionOutlined as InvoiceIcon,
  AccountBalance as AccountingIcon,
  Article as DocumentIcon,
  Settings as SettingsIcon,
  ManageAccounts as UsersIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  NavigateNext as NavIcon,
} from '@mui/icons-material';
import { employeeService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
  keywords?: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CPContext {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const CommandPaletteContext = React.createContext<CPContext>({
  open: false,
  setOpen: () => {},
});

export const useCommandPalette = () => React.useContext(CommandPaletteContext);

export const CommandPaletteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  );
};

// ─── Palette ──────────────────────────────────────────────────────────────────

const CommandPalette: React.FC = () => {
  const { open, setOpen } = useCommandPalette();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  // Fetch employees for search (only when palette is open)
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
    enabled: open,
    staleTime: 60_000,
  });

  const go = useCallback((path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  }, [navigate, setOpen]);

  // ── Navigation items ────────────────────────────────────────────────────────
  const navItems: CommandItem[] = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 16 }} />, action: () => go('/dashboard'), group: 'Navigate', keywords: 'home overview' },
    { id: 'employees', label: 'Employees', icon: <PeopleIcon sx={{ fontSize: 16 }} />, action: () => go('/employees'), group: 'Navigate', keywords: 'staff team members' },
    { id: 'leaves', label: 'Leave Management', icon: <LeaveIcon sx={{ fontSize: 16 }} />, action: () => go('/leaves'), group: 'Navigate', keywords: 'vacation time off absence' },
    { id: 'attendance', label: 'Attendance', icon: <AttendanceIcon sx={{ fontSize: 16 }} />, action: () => go('/attendance'), group: 'Navigate', keywords: 'clock in out checkin' },
    { id: 'timesheets', label: 'Timesheets', icon: <TimesheetIcon sx={{ fontSize: 16 }} />, action: () => go('/timesheets'), group: 'Navigate', keywords: 'hours time tracking work log' },
    { id: 'payroll', label: 'Payroll', icon: <PayrollIcon sx={{ fontSize: 16 }} />, action: () => go('/payroll'), group: 'Navigate', keywords: 'salary wages payslip' },
    { id: 'projects', label: 'Projects', icon: <ProjectIcon sx={{ fontSize: 16 }} />, action: () => go('/projects'), group: 'Navigate', keywords: 'work initiatives' },
    { id: 'resources', label: 'Resources', icon: <ResourceIcon sx={{ fontSize: 16 }} />, action: () => go('/resources'), group: 'Navigate', keywords: 'equipment assets laptop' },
    { id: 'assignments', label: 'Assignments', icon: <AssignmentIcon sx={{ fontSize: 16 }} />, action: () => go('/assignments'), group: 'Navigate', keywords: 'allocation assigned' },
    { id: 'expenses', label: 'Expense Claims', icon: <ExpenseIcon sx={{ fontSize: 16 }} />, action: () => go('/expense-claims'), group: 'Navigate', keywords: 'reimbursement receipts' },
    { id: 'invoices', label: 'Invoices', icon: <InvoiceIcon sx={{ fontSize: 16 }} />, action: () => go('/invoices'), group: 'Navigate', keywords: 'billing client payment' },
    { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: <AccountingIcon sx={{ fontSize: 16 }} />, action: () => go('/chart-of-accounts'), group: 'Navigate', keywords: 'gl accounts ledger' },
    { id: 'journal', label: 'Journal Entries', icon: <AccountingIcon sx={{ fontSize: 16 }} />, action: () => go('/journal-entries'), group: 'Navigate', keywords: 'debit credit accounting' },
    { id: 'ledger', label: 'General Ledger', icon: <AccountingIcon sx={{ fontSize: 16 }} />, action: () => go('/general-ledger'), group: 'Navigate', keywords: 'transactions balance' },
    { id: 'reports', label: 'Financial Reports', icon: <AccountingIcon sx={{ fontSize: 16 }} />, action: () => go('/financial-reports'), group: 'Navigate', keywords: 'income statement balance sheet p&l' },
    { id: 'documents', label: 'Documents', icon: <DocumentIcon sx={{ fontSize: 16 }} />, action: () => go('/documents'), group: 'Navigate', keywords: 'files upload passport id' },
    ...(isAdmin ? [
      { id: 'users', label: 'Users & Roles', icon: <UsersIcon sx={{ fontSize: 16 }} />, action: () => go('/users'), group: 'Navigate', keywords: 'permissions roles access' },
      { id: 'settings', label: 'Settings', icon: <SettingsIcon sx={{ fontSize: 16 }} />, action: () => go('/settings'), group: 'Navigate', keywords: 'organization tenant config' },
    ] : []),
  ], [go, isAdmin]);

  // Quick action items (shown when query is empty or matches)
  const quickActions: CommandItem[] = useMemo(() => [
    { id: 'new-leave', label: 'New Leave Request', description: 'Apply for time off', icon: <AddIcon sx={{ fontSize: 16 }} />, action: () => { go('/leaves'); }, group: 'Quick Actions' },
    { id: 'clock-in', label: 'Clock In / Clock Out', description: 'Record your attendance', icon: <AttendanceIcon sx={{ fontSize: 16 }} />, action: () => go('/attendance'), group: 'Quick Actions' },
    { id: 'new-expense', label: 'New Expense Claim', description: 'Submit a reimbursement', icon: <AddIcon sx={{ fontSize: 16 }} />, action: () => go('/expense-claims'), group: 'Quick Actions' },
    ...(isAdmin ? [
      { id: 'new-employee', label: 'Add Employee', description: 'Create a new employee profile', icon: <AddIcon sx={{ fontSize: 16 }} />, action: () => go('/employees'), group: 'Quick Actions' },
      { id: 'run-payroll', label: 'Run Payroll', description: 'Process monthly payroll', icon: <PayrollIcon sx={{ fontSize: 16 }} />, action: () => go('/payroll'), group: 'Quick Actions' },
      { id: 'new-invoice', label: 'New Invoice', description: 'Create a client invoice', icon: <AddIcon sx={{ fontSize: 16 }} />, action: () => go('/invoices'), group: 'Quick Actions' },
    ] : []),
  ], [go, isAdmin]);

  // ── Filter logic ────────────────────────────────────────────────────────────
  const allItems = useMemo((): CommandItem[] => {
    const q = query.toLowerCase().trim();
    if (!q) return [...quickActions, ...navItems.slice(0, 8)];

    const matchNav = navItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.includes(q))
    );

    const matchActions = quickActions.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );

    const matchEmployees: CommandItem[] = (employees as any[])
      .filter((e: any) => {
        const name = `${e.first_name} ${e.last_name}`.toLowerCase();
        return name.includes(q) || (e.email && e.email.toLowerCase().includes(q)) || (e.department && e.department.toLowerCase().includes(q));
      })
      .slice(0, 5)
      .map((e: any) => ({
        id: `emp-${e.id}`,
        label: `${e.first_name} ${e.last_name}`,
        description: `${e.position ?? ''} · ${e.department ?? ''}`,
        icon: <PersonIcon sx={{ fontSize: 16 }} />,
        action: () => go('/employees'),
        group: 'Employees',
      }));

    return [...matchActions, ...matchNav, ...matchEmployees];
  }, [query, navItems, quickActions, employees]);

  // Group items
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    allItems.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [allItems]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => allItems, [allItems]);

  // ── Reset on open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Reset selection when list changes
  useEffect(() => { setSelected(0); }, [query]);

  // ── Keyboard nav ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected(i => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        flatList[selected]?.action();
        setOpen(false);
        setQuery('');
      } else if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatList, selected, setOpen]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`) as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  let globalIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => { setOpen(false); setQuery(''); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1400,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="cp-panel"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              position: 'fixed',
              top: '15vh',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1401,
              width: '100%',
              maxWidth: 560,
              padding: '0 16px',
            }}
          >
            <Box sx={{
              bgcolor: '#fff',
              borderRadius: '14px',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 25px 50px rgba(0,0,0,0.18), 0 10px 20px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              maxHeight: '65vh',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Search input */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <SearchIcon sx={{ fontSize: 18, color: 'text.disabled', flexShrink: 0 }} />
                <InputBase
                  inputRef={inputRef}
                  fullWidth
                  placeholder="Search pages, employees, actions…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  sx={{ fontSize: '0.9375rem', '& input': { padding: 0 } }}
                />
                <Box sx={{
                  fontSize: '0.6875rem', fontWeight: 600, color: 'text.disabled',
                  border: '1px solid', borderColor: 'divider', borderRadius: '5px',
                  px: 0.75, py: 0.25, flexShrink: 0, letterSpacing: '0.02em',
                }}>
                  ESC
                </Box>
              </Box>

              {/* Results */}
              <Box ref={listRef} sx={{ overflowY: 'auto', py: 1 }}>
                {flatList.length === 0 ? (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">No results for "{query}"</Typography>
                  </Box>
                ) : (
                  Object.entries(grouped).map(([group, items], gi) => (
                    <Box key={group}>
                      {gi > 0 && <Divider sx={{ my: 0.5 }} />}
                      <Typography variant="caption" sx={{
                        display: 'block', px: 2.5, pt: 1, pb: 0.5,
                        fontWeight: 700, letterSpacing: '0.07em',
                        textTransform: 'uppercase', color: 'text.disabled', fontSize: '0.65rem',
                      }}>
                        {group}
                      </Typography>
                      {items.map(item => {
                        globalIndex++;
                        const idx = globalIndex;
                        const isSelected = selected === idx;
                        return (
                          <Box
                            key={item.id}
                            data-index={idx}
                            onClick={() => { item.action(); setOpen(false); setQuery(''); }}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1.5,
                              px: 2.5, py: 1, mx: 1, borderRadius: '8px',
                              cursor: 'pointer',
                              bgcolor: isSelected ? 'primary.main' : 'transparent',
                              transition: 'background-color 80ms',
                              '&:hover': { bgcolor: isSelected ? 'primary.main' : '#F8FAFC' },
                            }}
                          >
                            <Box sx={{ color: isSelected ? 'rgba(255,255,255,0.85)' : 'text.secondary', display: 'flex', flexShrink: 0 }}>
                              {item.icon}
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{
                                fontWeight: 500, fontSize: '0.875rem',
                                color: isSelected ? '#fff' : 'text.primary',
                              }}>
                                {item.label}
                              </Typography>
                              {item.description && (
                                <Typography variant="caption" sx={{
                                  color: isSelected ? 'rgba(255,255,255,0.65)' : 'text.secondary',
                                  fontSize: '0.75rem',
                                }}>
                                  {item.description}
                                </Typography>
                              )}
                            </Box>
                            <NavIcon sx={{ fontSize: 14, color: isSelected ? 'rgba(255,255,255,0.5)' : 'text.disabled', flexShrink: 0 }} />
                          </Box>
                        );
                      })}
                    </Box>
                  ))
                )}
              </Box>

              {/* Footer hint */}
              <Box sx={{ px: 2.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 2.5 }}>
                {[['↑↓', 'Navigate'], ['↵', 'Open'], ['Esc', 'Close']].map(([key, label]) => (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{
                      fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary',
                      border: '1px solid', borderColor: 'divider', borderRadius: '4px',
                      px: 0.6, py: 0.15, lineHeight: 1.4, fontFamily: 'monospace',
                    }}>
                      {key}
                    </Box>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6875rem' }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
