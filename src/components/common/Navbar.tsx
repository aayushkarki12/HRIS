import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/api';
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
  List,
  ListItemButton,
  ListItemText,
  Button,
  CircularProgress,
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
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = React.useState<null | HTMLElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 30000,
  });

  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getAll,
    enabled: !!notifAnchorEl,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => setNotifAnchorEl(event.currentTarget);
  const handleNotifClose = () => setNotifAnchorEl(null);

  const timeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
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
            <IconButton color="inherit" size="small" onClick={handleNotifOpen}>
              <Badge badgeContent={unreadCount} color="error" max={99}>
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={notifAnchorEl}
            open={Boolean(notifAnchorEl)}
            onClose={handleNotifClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { width: 380, maxHeight: 480 } } }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Notifications</Typography>
              {!!unreadCount && (
                <Button size="small" sx={{ textTransform: 'none' }} onClick={() => markAllReadMutation.mutate()}>
                  Mark all read
                </Button>
              )}
            </Box>
            <Divider />
            {notificationsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : !notifications || notifications.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No notifications yet</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {notifications.map((n: any) => (
                  <ListItemButton
                    key={n.id}
                    onClick={() => { if (!n.is_read) markReadMutation.mutate(n.id); }}
                    sx={{
                      alignItems: 'flex-start',
                      borderLeft: n.is_read ? 'none' : '3px solid',
                      borderLeftColor: 'primary.main',
                      backgroundColor: n.is_read ? 'transparent' : 'action.hover',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 600 }}>
                          {n.title}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block' }}>
                            {n.message}
                          </Typography>
                          <Typography variant="caption" color="text.disabled" component="span">
                            {timeAgo(n.created_at)}
                          </Typography>
                        </>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Menu>

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