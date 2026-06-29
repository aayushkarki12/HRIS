import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Chip,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Dashboard as DashboardIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

const drawerWidth = 240;

interface NavbarProps {
  onMenuToggle: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>
  <PersonIcon sx={{ mr: 1, fontSize: 20 }} /> Profile
  </MenuItem>
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // Debug logs
  console.log('Navbar - tenant:', tenant);
  console.log('Navbar - user:', user);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  // Get tenant display name
  const getTenantDisplay = () => {
    if (tenant?.name) {
      return tenant.name;
    }
    // Fallback: try to get from localStorage
    const storedTenant = localStorage.getItem('tenant');
    if (storedTenant) {
      try {
        const parsed = JSON.parse(storedTenant);
        return parsed.name || 'HRIS System';
      } catch (e) {
        return 'HRIS System';
      }
    }
    return 'HRIS System';
  };

  const getTenantSubdomain = () => {
    if (tenant?.subdomain) {
      return tenant.subdomain;
    }
    const storedTenant = localStorage.getItem('tenant');
    if (storedTenant) {
      try {
        const parsed = JSON.parse(storedTenant);
        return parsed.subdomain;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const tenantName = getTenantDisplay();
  const tenantSubdomain = getTenantSubdomain();

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${drawerWidth}px)` },
        ml: { sm: `${drawerWidth}px` },
        backgroundColor: 'white',
        color: 'text.primary',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuToggle}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Tenant Branding */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {tenant?.logo_url ? (
            <img 
              src={tenant.logo_url} 
              alt={tenant.name} 
              style={{ height: 32, width: 'auto' }} 
            />
          ) : (
            <BusinessIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          )}
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              fontWeight: 600,
              color: 'primary.main',
              fontSize: '1.1rem',
            }}
          >
            {tenantName}
          </Typography>
        </Box>

        {/* Tenant Subdomain Badge */}
        {tenantSubdomain && (
          <Chip
            label={tenantSubdomain}
            size="small"
            variant="outlined"
            sx={{ ml: 2, fontSize: '0.7rem', color: 'text.secondary' }}
          />
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Dashboard">
            <IconButton color="inherit" onClick={() => navigate('/dashboard')} size="small">
              <DashboardIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Notifications">
            <IconButton color="inherit" size="small">
              <Badge badgeContent={0} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' }, color: 'text.secondary', mx: 1 }}>
            {user?.first_name} {user?.last_name}
          </Typography>

          <Tooltip title="Account settings">
            <IconButton onClick={handleMenu} size="small">
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '14px' }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem disabled>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '12px' }}>
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </Avatar>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {user?.first_name} {user?.last_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.email}
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ display: 'block' }}>
                    {tenantName}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { navigate('/dashboard'); handleClose(); }}>
              <DashboardIcon sx={{ mr: 1, fontSize: 20 }} /> Dashboard
            </MenuItem>
            <MenuItem onClick={() => { navigate('/tenant-settings'); handleClose(); }}>
              <SettingsIcon sx={{ mr: 1, fontSize: 20 }} /> Organization Settings
            </MenuItem>
            <MenuItem onClick={() => { navigate('/profile'); handleClose(); }}>
              <PersonIcon sx={{ mr: 1, fontSize: 20 }} /> Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <LogoutIcon sx={{ mr: 1, fontSize: 20 }} /> Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;