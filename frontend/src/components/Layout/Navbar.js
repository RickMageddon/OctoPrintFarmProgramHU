import React, { useState } from 'react';
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
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const [anchorEl, setAnchorEl] = useState(null);

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

        {/* Connection Status */}
        <Chip
          label={isConnected ? 'Online' : 'Offline'}
          color={isConnected ? 'success' : 'error'}
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
          <Avatar sx={{ width: 32, height: 32 }}>
            {user?.username?.charAt(0).toUpperCase()}
          </Avatar>
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
