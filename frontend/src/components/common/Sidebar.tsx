import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Avatar,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import { DRAWER_WIDTH } from './Navbar';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Folder as FolderIcon,
  Logout as LogoutIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  EventNote as LeaveIcon,
  AccessTime as AttendanceIcon,
  Schedule as TimesheetIcon,
  ManageAccounts as UsersIcon,
  AdminPanelSettings as RolesIcon,
  ExpandLess,
  ExpandMore,
  Assignment as AssignmentIcon,
  Storage as ResourceIcon,
  FactCheckOutlined as AuditTrailIcon,
  MyLocation as WorkLocationIcon,
  InsightsOutlined as InsightsIcon,
  Inventory2 as InventoryIcon,
  SwapVert as StockLedgerIcon,
  Widgets as ItemsIcon,
  TuneOutlined as InventorySetupIcon,
  AssignmentReturn as CheckoutsIcon,
} from '@mui/icons-material';

interface SidebarProps {
  mobileOpen: boolean;
  onDrawerToggle: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface NavSection {
  label: string;
  icon: React.ReactNode;
  children: NavItem[];
  adminOnly?: boolean;
  managerOnly?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onDrawerToggle }) => {
  const { user, logout, isAdmin, isManager, tenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [openHR, setOpenHR] = useState(true);
  const [openProjects, setOpenProjects] = useState(true);
  const [openInventory, setOpenInventory] = useState(true);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (window.innerWidth < 600) onDrawerToggle();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isSelected = (path: string) => location.pathname === path;

  const subItemSx = {
    borderRadius: '6px',
    pl: 1.5,
    py: 0.6,
    mb: 0.25,
    '& .MuiListItemIcon-root': {
      minWidth: 28,
      '& svg': { fontSize: 15, color: 'text.disabled' },
    },
    '& .MuiListItemText-primary': {
      fontSize: '0.8125rem',
      color: 'text.secondary',
    },
    '&.Mui-selected': {
      bgcolor: '#F1F5F9',
      '& .MuiListItemText-primary': { color: '#0F172A', fontWeight: 600 },
      '& .MuiListItemIcon-root svg': { color: 'primary.main' },
    },
    '&:hover': { bgcolor: 'action.hover' },
    '&.Mui-selected:hover': { bgcolor: '#F1F5F9' },
  };

  const topItemSx = {
    borderRadius: '6px',
    mb: 0.25,
    '& .MuiListItemIcon-root': { minWidth: 36 },
    '& .MuiListItemText-primary': { fontSize: '0.875rem', fontWeight: 500 },
  };

  const sectionLabelSx = {
    px: 1.5,
    pt: 2,
    pb: 0.5,
  };

  const { data: myProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => import('../../services/api').then(m => m.employeeService.getMyProfile()),
    enabled: !!user?.id,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const userInitials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase();
  const userName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8010/api/v1').replace(/\/api\/v1\/?$/, '');
  const avatarSrc = myProfile?.profile_picture ? `${API_BASE}${myProfile.profile_picture}` : undefined;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo / Tenant header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          height: { xs: 56, sm: 60 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar
            src={tenant?.logo_url || undefined}
            variant="rounded"
            sx={{
              width: 28,
              height: 28,
              borderRadius: '6px',
              bgcolor: 'primary.main',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem', lineHeight: 1 }}>
              {(tenant?.name ?? 'H')[0].toUpperCase()}
            </Typography>
          </Avatar>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, color: 'text.primary', letterSpacing: '-0.01em' }}
            noWrap
          >
            {tenant?.name ?? 'HRIS'}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onDrawerToggle}
          sx={{ display: { xs: 'flex', sm: 'none' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Nav items */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
        {/* Dashboard */}
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => handleNavigation('/dashboard')}
              selected={isSelected('/dashboard')}
              sx={topItemSx}
            >
              <ListItemIcon><DashboardIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          </ListItem>
        </List>

        {/* HR Management */}
        <Typography variant="overline" sx={sectionLabelSx} display="block" color="text.disabled">
          HR
        </Typography>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setOpenHR(!openHR)} sx={topItemSx}>
              <ListItemIcon><PeopleIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText primary="HR Management" />
              {openHR ? <ExpandLess sx={{ fontSize: 16, color: 'text.disabled' }} /> : <ExpandMore sx={{ fontSize: 16, color: 'text.disabled' }} />}
            </ListItemButton>
          </ListItem>
          <Collapse in={openHR} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: 2, mt: 0.25 }}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/employees')}
                  selected={isSelected('/employees')}
                  sx={subItemSx}
                >
                  <ListItemIcon><PeopleIcon /></ListItemIcon>
                  <ListItemText primary="Employees" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/leaves')}
                  selected={isSelected('/leaves')}
                  sx={subItemSx}
                >
                  <ListItemIcon><LeaveIcon /></ListItemIcon>
                  <ListItemText primary="Leave Management" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/attendance')}
                  selected={isSelected('/attendance')}
                  sx={subItemSx}
                >
                  <ListItemIcon><AttendanceIcon /></ListItemIcon>
                  <ListItemText primary="Attendance" />
                </ListItemButton>
              </ListItem>
              {isManager && (
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/work-location')}
                    selected={isSelected('/work-location')}
                    sx={subItemSx}
                  >
                    <ListItemIcon><WorkLocationIcon /></ListItemIcon>
                    <ListItemText primary="Work & Location" />
                  </ListItemButton>
                </ListItem>
              )}
              {isManager && (
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => handleNavigation('/insights')}
                    selected={isSelected('/insights')}
                    sx={subItemSx}
                  >
                    <ListItemIcon><InsightsIcon /></ListItemIcon>
                    <ListItemText primary="Insights" />
                  </ListItemButton>
                </ListItem>
              )}
            </List>
          </Collapse>
        </List>

        {/* Project Management */}
        <Typography variant="overline" sx={sectionLabelSx} display="block" color="text.disabled">
          Projects
        </Typography>
        <List disablePadding>
          <ListItem disablePadding>
            <ListItemButton onClick={() => setOpenProjects(!openProjects)} sx={topItemSx}>
              <ListItemIcon><FolderIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText primary="Project Management" />
              {openProjects ? <ExpandLess sx={{ fontSize: 16, color: 'text.disabled' }} /> : <ExpandMore sx={{ fontSize: 16, color: 'text.disabled' }} />}
            </ListItemButton>
          </ListItem>
          <Collapse in={openProjects} timeout="auto" unmountOnExit>
            <List component="div" disablePadding sx={{ pl: 2, mt: 0.25 }}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/projects')}
                  selected={isSelected('/projects')}
                  sx={subItemSx}
                >
                  <ListItemIcon><FolderIcon /></ListItemIcon>
                  <ListItemText primary="Projects" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/resources')}
                  selected={isSelected('/resources')}
                  sx={subItemSx}
                >
                  <ListItemIcon><ResourceIcon /></ListItemIcon>
                  <ListItemText primary="Resources" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/assignments')}
                  selected={isSelected('/assignments')}
                  sx={subItemSx}
                >
                  <ListItemIcon><AssignmentIcon /></ListItemIcon>
                  <ListItemText primary="Assignments" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/item-checkouts')}
                  selected={isSelected('/item-checkouts')}
                  sx={subItemSx}
                >
                  <ListItemIcon><CheckoutsIcon /></ListItemIcon>
                  <ListItemText primary="Item Checkouts" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/timesheets')}
                  selected={isSelected('/timesheets')}
                  sx={subItemSx}
                >
                  <ListItemIcon><TimesheetIcon /></ListItemIcon>
                  <ListItemText primary="Timesheets" />
                </ListItemButton>
              </ListItem>
            </List>
          </Collapse>
        </List>

        {/* Inventory */}
        {isManager && (
          <>
          <Typography variant="overline" sx={sectionLabelSx} display="block" color="text.disabled">
            Inventory
          </Typography>
          <List disablePadding>
            <ListItem disablePadding>
              <ListItemButton onClick={() => setOpenInventory(!openInventory)} sx={topItemSx}>
                <ListItemIcon><InventoryIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                <ListItemText primary="Inventory" />
                {openInventory ? <ExpandLess sx={{ fontSize: 16, color: 'text.disabled' }} /> : <ExpandMore sx={{ fontSize: 16, color: 'text.disabled' }} />}
              </ListItemButton>
            </ListItem>
            <Collapse in={openInventory} timeout="auto" unmountOnExit>
              <List component="div" disablePadding sx={{ pl: 2, mt: 0.25 }}>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleNavigation('/stock-ledger')} selected={isSelected('/stock-ledger')} sx={subItemSx}>
                    <ListItemIcon><StockLedgerIcon /></ListItemIcon>
                    <ListItemText primary="Stock Ledger" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleNavigation('/items')} selected={isSelected('/items')} sx={subItemSx}>
                    <ListItemIcon><ItemsIcon /></ListItemIcon>
                    <ListItemText primary="Items" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => handleNavigation('/inventory-setup')} selected={isSelected('/inventory-setup')} sx={subItemSx}>
                    <ListItemIcon><InventorySetupIcon /></ListItemIcon>
                    <ListItemText primary="Setup" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Collapse>
          </List>
          </>
        )}

        {/* Admin */}
        {isAdmin && (
          <>
            <Typography variant="overline" sx={sectionLabelSx} display="block" color="text.disabled">
              Admin
            </Typography>
            <List disablePadding>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/users')}
                  selected={isSelected('/users')}
                  sx={topItemSx}
                >
                  <ListItemIcon><UsersIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  <ListItemText primary="Users & Roles" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/roles-permissions')}
                  selected={isSelected('/roles-permissions')}
                  sx={topItemSx}
                >
                  <ListItemIcon><RolesIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  <ListItemText primary="Roles & Permissions" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/audit-trail')}
                  selected={isSelected('/audit-trail')}
                  sx={topItemSx}
                >
                  <ListItemIcon><AuditTrailIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  <ListItemText primary="Audit Trail" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation('/tenant-settings')}
                  selected={isSelected('/tenant-settings')}
                  sx={topItemSx}
                >
                  <ListItemIcon><SettingsIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                  <ListItemText primary="Settings" />
                </ListItemButton>
              </ListItem>
            </List>
          </>
        )}
      </Box>

      {/* User footer */}
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 1.5,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: 1,
            borderRadius: '8px',
            '&:hover': { bgcolor: 'action.hover' },
            cursor: 'default',
          }}
        >
          <Avatar
            src={avatarSrc}
            sx={{
              bgcolor: '#FFFFFF',
              color: '#334155',
              border: '1.5px solid #CBD5E1',
              width: 32,
              height: 32,
              fontSize: '0.75rem',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {!avatarSrc && userInitials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.3 }}>
              {userName}
            </Typography>
            <Typography variant="caption" color="text.disabled" noWrap sx={{ lineHeight: 1.3 }}>
              {user?.role}
            </Typography>
          </Box>
          <Tooltip title="Sign out" placement="top">
            <IconButton
              size="small"
              onClick={handleLogout}
              sx={{
                color: 'text.disabled',
                flexShrink: 0,
                '&:hover': { color: 'error.main', bgcolor: '#FEF2F2' },
              }}
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
      aria-label="sidebar navigation"
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default Sidebar;
