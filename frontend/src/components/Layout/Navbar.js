import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Badge,
  Chip,
} from '@mui/material';
import {
  Dashboard,
  Print,
  CloudUpload,
  Queue,
  AccountCircle,
  Settings,
  Logout,
  AdminPanelSettings,
  Warning,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [printersOnline, setPrintersOnline] = useState(0);
  const [totalPrinters] = useState(3);

  // Fetch printer statuses
  useEffect(() => {
    const fetchPrinterStatus = async () => {
      try {
        const response = await axios.get('/api/printers/status');
        const onlineCount = response.data.filter(printer => 
          printer.state?.text && printer.state.text !== 'Offline'
        ).length;
        setPrintersOnline(onlineCount);
      } catch (error) {
        console.error('Error fetching printer status:', error);
        setPrintersOnline(0);
      }
    };

    if (user) {
      fetchPrinterStatus();
      // Poll every 30 seconds
      const interval = setInterval(fetchPrinterStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <Dashboard /> },
    { path: '/printers', label: 'Printers', icon: <Print /> },
    { path: '/files', label: 'Bestanden', icon: <CloudUpload /> },
    { path: '/queue', label: 'Wachtrij', icon: <Queue /> },
  ];

  return (
    <AppBar position="fixed" elevation={1}>
      <Toolbar>

        <Typography
          variant="h6"
          component="div"
          sx={{ cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          Printmeister
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', ml: 4 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              startIcon={item.icon}
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1,
                color: isActive(item.path) ? 'primary.main' : 'inherit',
                backgroundColor: isActive(item.path) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* Printer Status */}
        <Chip
          label={`Printers: ${printersOnline}/${totalPrinters} Online`}
          color={printersOnline > 0 ? 'success' : 'error'}
          size="small"
          sx={{ mr: 2 }}
        />

        {/* Admin Button */}
        {user?.is_admin && (
          <Button
            startIcon={<AdminPanelSettings />}
            onClick={() => navigate('/admin')}
            sx={{
              mr: 1,
              color: isActive('/admin') ? 'primary.main' : 'inherit',
              backgroundColor: isActive('/admin') ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }}
          >
            Admin
          </Button>
        )}

        {/* User Info - Klikbaar naar profiel */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', ml: 2 }}
          onClick={() => navigate('/profile')}
        >
          <Badge
            badgeContent={!user?.study_direction ? <Warning sx={{ fontSize: 16 }} /> : null}
            color="warning"
            overlap="circular"
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        </Box>

        <Menu
          id="primary-search-account-menu"
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          keepMounted
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
        >
          <MenuItem
            onClick={() => {
              handleProfileMenuClose();
              setTimeout(() => navigate('/profile'), 0);
            }}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <AccountCircle sx={{ mr: 2 }} />
            <span style={{ cursor: 'pointer', fontWeight: 600 }}>
              {user?.username || 'Profiel'}
            </span>
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <Logout sx={{ mr: 2 }} />
            Uitloggen
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
