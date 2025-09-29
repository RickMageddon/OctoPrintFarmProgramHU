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
    console.log('🔌 Socket effect triggered, user:', user);
    console.log('📧 Email verified:', user?.email_verified);
    console.log('🔗 Socket connected:', socket.connected);

    if (user) {
      // Connect socket when user is authenticated (email verification not required for basic functionality)
      if (!socket.connected) {
        console.log('🚀 Connecting socket...');
        socket.connect();
        
        // Join user room for personal notifications
        socket.emit('join-room', `user-${user.id}`);
        
        // Join general room for printer updates
        socket.emit('join-room', 'general');

        console.log('✅ Socket connected');
      }
    } else if (socket.connected) {
      // Disconnect socket when user is not authenticated
      console.log('🔌 Disconnecting socket...');
      socket.disconnect();
      console.log('❌ Socket disconnected');
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
