import React from 'react';
import { useAuth } from '../../context/AuthContext';
import AccessDenied from './AccessDenied';

interface RequireRoleProps {
  /** Minimum role required - 'manager' also admits admins, same as isManager elsewhere in the app. */
  role: 'admin' | 'manager';
  children: React.ReactNode;
}

/**
 * Router-level role guard. PrivateRoute only checks "is logged in" and
 * renders a shared <Outlet/> for every page, so until now the router itself
 * had no opinion on who could reach /users, /vouchers, /payroll-adjacent
 * finance pages, etc. - each page was individually responsible for its own
 * `if (!isAdmin) return <AccessDenied/>` check. That worked, but it made
 * protection opt-in per page: a new sensitive route that forgot to add its
 * own check would be silently reachable by any authenticated user.
 *
 * Wrapping a route's element in RequireRole makes the guard live at the
 * router too, so it isn't solely up to each page component to remember.
 */
const RequireRole: React.FC<RequireRoleProps> = ({ role, children }) => {
  const { isAdmin, isManager } = useAuth();
  const allowed = role === 'admin' ? isAdmin : isManager;
  if (!allowed) return <AccessDenied />;
  return <>{children}</>;
};

export default RequireRole;
