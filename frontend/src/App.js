import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';
import io from 'socket.io-client';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Navbar from './components/Layout/Navbar';
import LoadingSpinner from './components/Common/LoadingSpinner';

// Pages
import LoginPage from './pages/LoginPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import StudyDirectionSetup from './pages/StudyDirectionSetup';
import DashboardPage from './pages/DashboardPage';
import PrintersPage from './pages/PrintersPage';
import FilesPage from './pages/FilesPage';
import QueuePage from './pages/QueuePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';

// Theme configuration
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: '12px',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

// Socket connection
const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001', {
  autoConnect: false,
});

function ProtectedRoute({ children, requireEmailVerified = true, requireStudyDirection = true }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireEmailVerified && !user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (requireStudyDirection && !user.study_direction) {
    return <Navigate to="/setup/study-direction" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user || !user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {user && <Navbar />}
      
      <main style={{ flex: 1, paddingTop: user ? '64px' : '0' }}>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              user ? (
                user.email_verified ? (
                  user.study_direction ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <Navigate to="/setup/study-direction" replace />
                  )
                ) : (
                  <Navigate to="/verify-email" replace />
                )
              ) : (
                <LoginPage />
              )
            } 
          />
          
          {/* Registration route */}
          <Route 
            path="/register" 
            element={
              user ? (
                user.email_verified ? (
                  user.study_direction ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <Navigate to="/setup/study-direction" replace />
                  )
                ) : (
                  <Navigate to="/verify-email" replace />
                )
              ) : (
                <EmailVerificationPage />
              )
            } 
          />
          
          {/* Email verification route (kept for compatibility) */}
          <Route 
            path="/verify-email" 
            element={
              user && !user.email_verified ? (
                <EmailVerificationPage />
              ) : user ? (
                user.study_direction ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/setup/study-direction" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Study direction setup route */}
          <Route 
            path="/setup/study-direction" 
            element={
              user ? (
                user.email_verified ? (
                  user.study_direction ? (
                    <Navigate to="/dashboard" replace />
                  ) : (
                    <StudyDirectionSetup />
                  )
                ) : (
                  <Navigate to="/verify-email" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/printers" 
            element={
              <ProtectedRoute>
                <PrintersPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/files" 
            element={
              <ProtectedRoute>
                <FilesPage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/queue" 
            element={
              <ProtectedRoute>
                <QueuePage />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />

          {/* Admin routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              </ProtectedRoute>
            } 
          />

          {/* Default redirect */}
          <Route 
            path="/" 
            element={
              <Navigate to={
                user ? (
                  user.email_verified ? (
                    user.study_direction ? "/dashboard" : "/setup/study-direction"
                  ) : "/verify-email"
                ) : "/login"
              } replace />
            } 
          />
          
          {/* 404 redirect */}
          <Route 
            path="*" 
            element={
              <Navigate to={
                user ? (
                  user.email_verified ? (
                    user.study_direction ? "/dashboard" : "/setup/study-direction"
                  ) : "/verify-email"
                ) : "/login"
              } replace />
            } 
          />
        </Routes>
      </main>
      
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <SocketProvider socket={socket}>
            <AppContent />
          </SocketProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
