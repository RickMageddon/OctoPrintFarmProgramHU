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
  axios.defaults.baseURL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get('/api/auth/status');
      if (response.data.authenticated) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = '/api/auth/github';
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
      const response = await axios.get('/api/auth/user');
      setUser(response.data);
    } catch (error) {
      console.error('Error refreshing user:', error);
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

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    verifyEmail,
    verifyCode,
    setStudyDirection,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
