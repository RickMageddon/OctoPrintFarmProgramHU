import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Configure axios defaults
  axios.defaults.withCredentials = true;
  // In Docker gebruik relatieve URLs zodat nginx de requests kan proxyen
  axios.defaults.baseURL = process.env.REACT_APP_BACKEND_URL || '';

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Checking auth status...');
      const response = await axios.get('/api/auth/status');
      console.log('📨 Auth status response:', response.data);
      
      if (response.data.authenticated) {
        console.log('✅ User authenticated:', response.data.user);
        setUser(response.data.user);
      } else {
        console.log('❌ User not authenticated');
        setUser(null);
      }
    } catch (error) {
      console.error('💥 Error checking auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = '/api/auth/github';
  };

  // GitHub Device Flow methods
  const startGitHubDeviceFlow = async () => {
    try {
      const response = await axios.post('/api/auth/github/device');
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to start GitHub authentication' };
    }
  };

  const pollGitHubDeviceFlow = async () => {
    try {
      const response = await axios.post('/api/auth/github/device/poll');
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to check authentication status' };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const refreshUser = async () => {
    try {
      console.log('🔄 Refreshing user data...');
      const response = await axios.get('/api/auth/user');
      console.log('📨 Refresh user response:', response.data);
      setUser(response.data);
    } catch (error) {
      console.error('💥 Error refreshing user:', error);
    }
  };

  const verifyEmail = async (email) => {
    try {
      const response = await axios.post('/api/auth/register', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to send verification email' };
    }
  };

  const verifyCode = async (token, code) => {
    try {
      const response = await axios.post('/api/auth/verify-registration', { token, code });
      if (response.data.success) {
        await refreshUser();
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to verify code' };
    }
  };

  const setStudyDirection = async (studyDirection) => {
    try {
      const response = await axios.post('/api/auth/study-direction', { studyDirection });
      if (response.data.success) {
        await refreshUser();
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || { error: 'Failed to set study direction' };
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Check auth status when URL changes (for OAuth redirects)
  useEffect(() => {
    const handlePopState = () => {
      checkAuthStatus();
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Add refresh method that can be called after OAuth redirect
  const refreshAuthStatus = async () => {
    setLoading(true);
    await checkAuthStatus();
  };

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    refreshAuthStatus,
    verifyEmail,
    verifyCode,
    setStudyDirection,
    startGitHubDeviceFlow,
    pollGitHubDeviceFlow,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
