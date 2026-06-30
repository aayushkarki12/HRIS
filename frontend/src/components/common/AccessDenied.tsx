import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';

const AccessDenied: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
    <Card sx={{ maxWidth: 500, p: 3, textAlign: 'center' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="textSecondary">
          You don't have permission to view this page.
        </Typography>
      </CardContent>
    </Card>
  </Box>
);

export default AccessDenied;
