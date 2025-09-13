import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, socket }) => {
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.email_verified) {
      // Connect socket when user is authenticated and verified
      socket.connect();
      
      // Join user room for personal notifications
      socket.emit('join-room', `user-${user.id}`);
      
      // Join general room for printer updates
      socket.emit('join-room', 'general');

      console.log('Socket connected');
    } else if (socket.connected) {
      // Disconnect socket when user is not authenticated
      socket.disconnect();
      console.log('Socket disconnected');
    }

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [user, socket]);

  const value = {
    socket,
    isConnected: socket.connected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
