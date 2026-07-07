import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
  index?: number;
  dense?: boolean;
}

const SectionCard: React.FC<Props> = ({ title, icon: Icon, action, children, index = 0, dense }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25, delay: Math.min(index, 6) * 0.04 }}
  >
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2, overflow: 'hidden', transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: '0 2px 12px rgba(15,23,42,0.06)' },
      }}
    >
      <Box sx={{
        px: dense ? 2 : 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#F8FAFC',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {Icon && <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />}
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: '0.06em', color: 'text.secondary' }}>
            {title}
          </Typography>
        </Box>
        {action}
      </Box>
      <Box sx={{ p: dense ? 2 : 3 }}>{children}</Box>
    </Paper>
  </motion.div>
);

export default SectionCard;
