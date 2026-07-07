import React, { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import Navbar, { DRAWER_WIDTH } from '../common/Navbar';
import Sidebar from '../common/Sidebar';
import LoadingSpinner from '../LoadingSpinner';

// Subtle page transition — enterprise feel: quick fade + 6px lift
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0 },
};

const pageTransition = {
  duration: 0.18,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

const PrivateRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (loading) return <LoadingSpinner fullScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar onMenuToggle={() => setMobileOpen((v) => !v)} />
      <Sidebar mobileOpen={mobileOpen} onDrawerToggle={() => setMobileOpen((v) => !v)} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // Reserve exact sidebar width on sm+ so content never overlaps
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          // Push content below the fixed AppBar
          mt: { xs: '56px', sm: '60px' },
          minHeight: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 60px)' },
          overflow: 'auto',
        }}
      >
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            maxWidth: 1600,
            mx: 'auto',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              style={{ minHeight: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
};

export default PrivateRoute;
