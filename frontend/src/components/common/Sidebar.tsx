import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
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
  Button,
  IconButton,
  Toolbar,
  Chip,
  Collapse,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Computer as ComputerIcon,
  Folder as FolderIcon,
  Assignment as AssignmentIcon,
  Logout as LogoutIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Description as DocumentIcon,
  EventNote as LeaveIcon,
  AccessTime as AttendanceIcon,
  Schedule as TimesheetIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';

const drawerWidth = 240;

interface SidebarProps {
  mobileOpen: boolean;
  onDrawerToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onDrawerToggle }) => {
  const { user, logout, isAdmin, tenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [openHR, setOpenHR] = useState(true);
  const [openProjects, setOpenProjects] = useState(true);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (window.innerWidth < 600) onDrawerToggle();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSelected = (path: string) => location.pathname === path;

  const drawerContent = (
    <>
      <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            {tenant?.name || 'HRIS'}
          </Typography>
        </Box>
        {window.innerWidth < 600 && (
          <IconButton onClick={onDrawerToggle}>
            <CloseIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />

      <List sx={{ flex: 1, overflowY: 'auto', pt: 2, px: 1 }}>
        {/* Dashboard */}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            onClick={() => handleNavigation('/dashboard')}
            selected={isSelected('/dashboard')}
            sx={{ borderRadius: 1 }}
          >
            <ListItemIcon><DashboardIcon /></ListItemIcon>
            <ListItemText primary="Dashboard" />
          </ListItemButton>
        </ListItem>

        {/* HR Management */}
        <ListItem disablePadding>
          <ListItemButton onClick={() => setOpenHR(!openHR)} sx={{ borderRadius: 1 }}>
            <ListItemIcon><PeopleIcon /></ListItemIcon>
            <ListItemText primary="HR Management" />
            {openHR ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={openHR} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/employees')}
                selected={isSelected('/employees')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Employees" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/documents')}
                selected={isSelected('/documents')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Documents" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/leaves')}
                selected={isSelected('/leaves')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Leave Management" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/attendance')}
                selected={isSelected('/attendance')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Attendance" />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>

        {/* Project Management */}
        <ListItem disablePadding>
          <ListItemButton onClick={() => setOpenProjects(!openProjects)} sx={{ borderRadius: 1 }}>
            <ListItemIcon><FolderIcon /></ListItemIcon>
            <ListItemText primary="Project Management" />
            {openProjects ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={openProjects} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/projects')}
                selected={isSelected('/projects')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Projects" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/resources')}
                selected={isSelected('/resources')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Resources" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/assignments')}
                selected={isSelected('/assignments')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Assignments" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ pl: 4 }}>
              <ListItemButton
                onClick={() => handleNavigation('/timesheets')}
                selected={isSelected('/timesheets')}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText primary="Timesheets" />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>

        {/* Settings */}
        {isAdmin && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => handleNavigation('/tenant-settings')}
              selected={isSelected('/tenant-settings')}
              sx={{ borderRadius: 1 }}
            >
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>
          </ListItem>
        )}
      </List>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 40, height: 40 }}>
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 'medium' }}>
              {user?.first_name} {user?.last_name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.email}
            </Typography>
            <Chip
              label={user?.role}
              size="small"
              sx={{ mt: 0.5, height: 16, fontSize: '0.6rem' }}
            />
          </Box>
        </Box>
        <Button
          variant="contained"
          color="error"
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          size="small"
        >
          Logout
        </Button>
      </Box>
    </>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      aria-label="sidebar navigation"
    >
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            borderRight: '1px solid rgba(0,0,0,0.08)',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};

export default Sidebar;