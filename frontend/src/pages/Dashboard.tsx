import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Paper,
  Divider,
  LinearProgress,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  People as PeopleIcon,
  Computer as ComputerIcon,
  Folder as FolderIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { employeeService, resourceService, projectService, assignmentService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Dashboard: React.FC = () => {
  const { isAdmin, user } = useAuth();

const { 
  data: employees = [],  // Default to empty array
  isLoading: employeesLoading,
  error: employeesError 
} = useQuery({
  queryKey: ['employees'],
  queryFn: employeeService.getAll,
  retry: 1,
});

const { 
  data: resources = [],  // Default to empty array
  isLoading: resourcesLoading,
  error: resourcesError 
} = useQuery({
  queryKey: ['resources'],
  queryFn: resourceService.getAll,
  retry: 1,
});

const { 
  data: projects = [],  // Default to empty array
  isLoading: projectsLoading,
  error: projectsError 
} = useQuery({
  queryKey: ['projects'],
  queryFn: projectService.getAll,
  retry: 1,
});

  const { 
    data: assignments, 
    isLoading: assignmentsLoading  } = useQuery({
    queryKey: ['assignments'],
    queryFn: assignmentService.getAll,
    enabled: isAdmin,
    retry: 1,
  });

  // Show loading state
  if (employeesLoading || resourcesLoading || projectsLoading || assignmentsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error state
  if (employeesError || resourcesError || projectsError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading data. Please refresh the page.
        </Alert>
        <Typography variant="body2" color="textSecondary">
          {employeesError?.message || resourcesError?.message || projectsError?.message}
        </Typography>
      </Box>
    );
  }

  // Calculate stats
  const totalEmployees = employees?.length || 0;
  const activeEmployees = employees?.filter((e: any) => e.is_active).length || 0;
  const totalResources = resources?.length || 0;
  const availableResources = resources?.filter((r: any) => r.status === 'available').length || 0;
  const assignedResources = resources?.filter((r: any) => r.status === 'assigned').length || 0;
  const totalProjects = projects?.length || 0;
  const activeProjects = projects?.filter((p: any) => p.status === 'active').length || 0;
  const completedProjects = projects?.filter((p: any) => p.status === 'completed').length || 0;
  const activeAssignments = assignments?.filter((a: any) => a.status === 'active').length || 0;

  // Stats cards data
  const statsCards = [
    {
      title: 'Total Employees',
      value: totalEmployees,
      icon: PeopleIcon,
      color: '#667eea',
      bgColor: '#e8edff',
      subtitle: `${activeEmployees} active`,
    },
    {
      title: 'Total Resources',
      value: totalResources,
      icon: ComputerIcon,
      color: '#2ecc71',
      bgColor: '#e8f8ef',
      subtitle: `${availableResources} available`,
    },
    {
      title: 'Active Projects',
      value: activeProjects,
      icon: FolderIcon,
      color: '#f39c12',
      bgColor: '#fef9e7',
      subtitle: `${completedProjects} completed`,
    },
    ...(isAdmin ? [{
      title: 'Active Assignments',
      value: activeAssignments,
      icon: AssignmentIcon,
      color: '#e74c3c',
      bgColor: '#fde8e8',
      subtitle: 'Currently allocated',
    }] : []),
  ];

  // Resource status data
  const resourceData = [
    { label: 'Available', value: availableResources, color: '#2ecc71' },
    { label: 'Assigned', value: assignedResources, color: '#3498db' },
    { label: 'Maintenance', value: resources?.filter((r: any) => r.status === 'maintenance').length || 0, color: '#f39c12' },
  ];

  const total = resourceData.reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#2c3e50' }}>
          Welcome back, {user?.first_name} {user?.last_name}! 👋
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Here's what's happening with your HRIS system today
        </Typography>
      </Box>

      {/* Stats Cards - Using flexbox instead of Grid */}
      <Box sx={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 3, 
        mb: 4 
      }}>
        {statsCards.map((stat, index) => (
          <Box key={index} sx={{ 
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', lg: '1 1 calc(25% - 18px)' },
            minWidth: { xs: '100%', sm: '200px' }
          }}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                },
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontWeight: 500, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.5px',
                        color: 'text.secondary'
                      }}
                    >
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: '#2c3e50' }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {stat.subtitle}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: stat.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <stat.icon sx={{ color: stat.color, fontSize: 28 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Charts and Details Section - Using flexbox */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {/* Resource Status */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              height: '100%',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2c3e50' }}>
              Resource Status
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <Box>
              {resourceData.map((item) => (
                <Box key={item.label} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: item.color }}>
                      {item.value}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={total > 0 ? (item.value / total) * 100 : 0}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: '#f0f0f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: item.color,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Total Resources: {totalResources}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Available: {availableResources} ({total > 0 ? Math.round((availableResources / total) * 100) : 0}%)
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Project Status */}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
              height: '100%',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2c3e50' }}>
              Project Status
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#e8f8ef', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon sx={{ color: '#2ecc71' }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Active</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2ecc71' }}>
                  {activeProjects}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#fef9e7', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon sx={{ color: '#f39c12' }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Completed</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f39c12' }}>
                  {completedProjects}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#fde8e8', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon sx={{ color: '#e74c3c' }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>On Hold</Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#e74c3c' }}>
                  {projects?.filter((p: any) => p.status === 'on-hold').length || 0}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Total Projects: {totalProjects}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Completion Rate: {totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0}%
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Quick Overview */}
        <Box sx={{ flex: '1 1 100%' }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#2c3e50' }}>
              Quick Overview
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.33% - 16px)' } }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#667eea' }}>
                    {totalEmployees}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total Employees</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {activeEmployees} active
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.33% - 16px)' } }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#2ecc71' }}>
                    {availableResources}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Available Resources</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {totalResources} total
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 calc(33.33% - 16px)' } }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#f39c12' }}>
                    {activeProjects}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Active Projects</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {totalProjects} total
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </>
  );
};

export default Dashboard;