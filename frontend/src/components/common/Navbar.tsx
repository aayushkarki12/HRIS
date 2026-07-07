import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useCommandPalette } from './CommandPalette';
import { notificationService } from '../../services/api';
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  Divider,
  Typography,
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
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  NotificationsNone as NotificationsNoneIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

export const DRAWER_WIDTH = 256;

interface NavbarProps {
  onMenuToggle: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { user, tenant, logout, isAdmin } = useAuth();
  const { setOpen: openPalette } = useCommandPalette();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = React.useState<null | HTMLElement>(null);

  // ── Notifications ──────────────────────────────────────────────────────────
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 30_000,
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

  // ── Helpers ────────────────────────────────────────────────────────────────
  const timeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const { data: myProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => import('../../services/api').then(m => m.employeeService.getMyProfile()),
    enabled: !!user?.id,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const userInitials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase();
  const avatarSrc = myProfile?.profile_picture ? `http://localhost:8000${myProfile.profile_picture}` : undefined;
  const tenantName = tenant?.name ?? 'HRIS System';

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    setAnchorEl(null);
    queryClient.clear();
    await logout();
    navigate('/login');
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { sm: `${DRAWER_WIDTH}px` },
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 56, sm: 60 }, px: { xs: 2, sm: 3 }, gap: 1 }}>
        {/* Mobile hamburger */}
        <IconButton
          aria-label="open navigation"
          edge="start"
          onClick={onMenuToggle}
          sx={{ display: { sm: 'none' }, mr: 0.5 }}
        >
          <MenuIcon sx={{ fontSize: 22 }} />
        </IconButton>

        {/* Page title / tenant name shown on desktop */}
        <Typography
          variant="subtitle2"
          noWrap
          sx={{
            display: { xs: 'none', md: 'block' },
            color: 'text.secondary',
            fontWeight: 400,
            fontSize: '0.8125rem',
          }}
        >
          {tenantName}
        </Typography>

        {/* ⌘K Search trigger */}
        <Box
          onClick={() => openPalette(true)}
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            cursor: 'pointer',
            bgcolor: '#F8FAFC',
            transition: 'all 150ms ease',
            '&:hover': { borderColor: 'primary.main', bgcolor: '#EEF2FF' },
            minWidth: 200,
          }}
        >
          <SearchIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.disabled" sx={{ flex: 1, fontSize: '0.8125rem' }}>
            Search…
          </Typography>
          <Box sx={{
            display: 'flex', gap: 0.5, alignItems: 'center',
          }}>
            {['Ctrl', 'K'].map(k => (
              <Box key={k} sx={{
                fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled',
                border: '1px solid', borderColor: 'divider', borderRadius: '4px',
                px: 0.6, py: 0.1, lineHeight: 1.6, letterSpacing: '0.02em',
              }}>{k}</Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* Right side actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Notification bell */}
          <Tooltip title="Notifications">
            <IconButton
              aria-label={`${unreadCount} unread notifications`}
              onClick={(e) => setNotifAnchorEl(e.currentTarget)}
              size="small"
              sx={{ position: 'relative' }}
            >
              <Badge
                badgeContent={unreadCount}
                color="error"
                max={99}
                sx={{ '& .MuiBadge-badge': { top: 2, right: 2 } }}
              >
                {unreadCount > 0 ? (
                  <NotificationsIcon sx={{ fontSize: 20 }} />
                ) : (
                  <NotificationsNoneIcon sx={{ fontSize: 20 }} />
                )}
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Notification panel */}
          <Menu
            anchorEl={notifAnchorEl}
            open={Boolean(notifAnchorEl)}
            onClose={() => setNotifAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: {
                sx: {
                  width: 360,
                  maxHeight: 480,
                  mt: 0.5,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                },
              },
            }}
          >
            {/* Panel header */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: 2,
                py: 1.5,
                flexShrink: 0,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Notifications
                {unreadCount > 0 && (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: 'error.main',
                      color: '#fff',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                    }}
                  >
                    {unreadCount}
                  </Box>
                )}
              </Typography>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  sx={{ fontSize: '0.75rem', py: 0.5 }}
                >
                  Mark all read
                </Button>
              )}
            </Box>

            <Divider />

            {/* Panel body */}
            <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
              {notificationsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : !notifications || notifications.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <NotificationsNoneIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No notifications yet
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {notifications.map((n: any) => (
                    <ListItemButton
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) markReadMutation.mutate(n.id);
                        setNotifAnchorEl(null);
                      }}
                      sx={{
                        alignItems: 'flex-start',
                        px: 2,
                        py: 1.5,
                        borderRadius: 0,
                        borderLeft: '3px solid',
                        borderLeftColor: n.is_read ? 'transparent' : 'primary.main',
                        backgroundColor: n.is_read ? 'transparent' : '#F8F9FF',
                        '&:hover': { backgroundColor: n.is_read ? 'action.hover' : '#F0F2FF' },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: n.is_read ? 400 : 600, color: 'text.primary', mb: 0.25 }}
                          >
                            {n.title}
                          </Typography>
                        }
                        secondary={
                          <Box component="span">
                            {n.message && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}
                              >
                                {n.message}
                              </Typography>
                            )}
                            <Typography component="span" variant="caption" sx={{ color: 'text.disabled' }}>
                              {timeAgo(n.created_at)}
                            </Typography>
                          </Box>
                        }
                        disableTypography
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          </Menu>

          {/* Divider */}
          <Box
            sx={{
              width: 1,
              height: 24,
              bgcolor: 'divider',
              mx: 0.5,
              display: { xs: 'none', sm: 'block' },
            }}
          />

          {/* User avatar menu */}
          <Tooltip title="Account">
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              size="small"
              aria-label="account menu"
              sx={{ p: 0.5 }}
            >
              <Avatar
                src={avatarSrc}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.main',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {!avatarSrc && userInitials}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { width: 220, mt: 0.5 } } }}
          >
            {/* User info header */}
            <Box sx={{ px: 1.5, py: 1.25 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }} noWrap>
                {user?.first_name} {user?.last_name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {user?.email}
              </Typography>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500, display: 'block', mt: 0.25 }}>
                {tenantName}
              </Typography>
            </Box>

            <Divider sx={{ my: 0.5 }} />

            <MenuItem onClick={() => { navigate('/profile'); setAnchorEl(null); }}>
              <PersonIcon sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} />
              Profile
            </MenuItem>

            {isAdmin && (
              <MenuItem onClick={() => { navigate('/tenant-settings'); setAnchorEl(null); }}>
                <SettingsIcon sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} />
                Settings
              </MenuItem>
            )}

            <Divider sx={{ my: 0.5 }} />

            <MenuItem
              onClick={handleLogout}
              sx={{ color: 'error.main', '& .MuiSvgIcon-root': { color: 'error.main' } }}
            >
              <LogoutIcon sx={{ mr: 1.5, fontSize: 18 }} />
              Sign out
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
