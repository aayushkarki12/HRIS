import React, { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../common/Navbar';
import Sidebar from '../common/Sidebar';
import LoadingSpinner from '../LoadingSpinner';

const drawerWidth = 240;

const PrivateRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const handleDrawerToggle = (): void => {
    setMobileOpen(!mobileOpen);
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      {/* Only ONE navbar */}
      <Navbar onMenuToggle={handleDrawerToggle} />
      <Sidebar mobileOpen={mobileOpen} onDrawerToggle={handleDrawerToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          mt: '64px',
          minHeight: 'calc(100vh - 64px)',
          backgroundColor: '#f5f7fa',
        }}
      >
        <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default PrivateRoute;