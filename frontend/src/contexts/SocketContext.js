import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('🔌 Socket effect triggered, user:', user);
    console.log('📧 Email verified:', user?.email_verified);
    console.log('🔗 Socket connected:', socket.connected);

    // Set up socket event listeners
    const handleConnect = () => {
      console.log('✅ Socket connected');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Set initial state
    setIsConnected(socket.connected);

    if (user) {
      // Connect socket when user is authenticated (email verification not required for basic functionality)
      if (!socket.connected) {
        console.log('🚀 Connecting socket...');
        socket.connect();
        
        // Join user room for personal notifications
        socket.emit('join-room', `user-${user.id}`);
        
        // Join general room for printer updates
        socket.emit('join-room', 'general');
      }
    } else if (socket.connected) {
      // Disconnect socket when user is not authenticated
      console.log('🔌 Disconnecting socket...');
      socket.disconnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      if (socket.connected && !user) {
        socket.disconnect();
      }
    };
  }, [user, socket]);

  const value = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
