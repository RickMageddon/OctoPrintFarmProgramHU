import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Print,
  Queue,
  CloudUpload,
  CheckCircle,
  Error,
  Pause,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const DashboardPage = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [printerStatus, setPrinterStatus] = useState([]);
  const [queueStats, setQueueStats] = useState({});
  const [userStats, setUserStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('printer-status-update', (data) => {
        setPrinterStatus(data);
      });

      socket.on('queue-updated', () => {
        fetchQueueStats();
      });

      return () => {
        socket.off('printer-status-update');
        socket.off('queue-updated');
      };
    }
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      const [printersResponse, queueResponse, profileResponse] = await Promise.all([
        axios.get('/api/printers/status'),
        axios.get('/api/queue'),
        axios.get('/api/users/profile'),
      ]);

      setPrinterStatus(printersResponse.data);
      
      // Calculate queue stats
      const queue = queueResponse.data;
      const stats = {
        total: queue.length,
        queued: queue.filter(job => job.status === 'queued').length,
        printing: queue.filter(job => job.status === 'printing').length,
        completed: queue.filter(job => job.status === 'completed').length,
        myJobs: queue.filter(job => job.user_id === user.id).length,
      };
      setQueueStats(stats);
      
      setUserStats(profileResponse.data.stats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const response = await axios.get('/api/queue');
      const queue = response.data;
      const stats = {
        total: queue.length,
        queued: queue.filter(job => job.status === 'queued').length,
        printing: queue.filter(job => job.status === 'printing').length,
        completed: queue.filter(job => job.status === 'completed').length,
        myJobs: queue.filter(job => job.user_id === user.id).length,
      };
      setQueueStats(stats);
    } catch (error) {
      console.error('Error fetching queue stats:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'operational':
        return <CheckCircle color="success" />;
      case 'printing':
        return <Print color="primary" />;
      case 'paused':
        return <Pause color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Error color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'operational':
        return 'success';
      case 'printing':
        return 'primary';
      case 'paused':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Container>
        <Box py={4}>
          <LinearProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Welkom terug, {user.username}! Hier is een overzicht van Printmeister.
        </Typography>

        {/* Printer Status */}
        <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
          Printer Status
        </Typography>
        
        <Grid container spacing={3} mb={4}>
          {printerStatus.map((printer, index) => (
            <Grid item xs={12} md={4} key={printer.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      {getStatusIcon(printer.state?.text)}
                      <Typography variant="h6" ml={1}>
                        {printer.name}
                      </Typography>
                    </Box>
                    
                    <Chip
                      label={printer.state?.text || 'Offline'}
                      color={getStatusColor(printer.state?.text)}
                      size="small"
                      sx={{ mb: 2 }}
                    />

                    {printer.job?.job?.file?.name && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Huidige Print:
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {printer.job.job.file.name}
                        </Typography>
                        
                        {printer.job.progress?.completion && (
                          <Box mt={1}>
                            <LinearProgress
                              variant="determinate"
                              value={printer.job.progress.completion}
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="caption">
                              {Math.round(printer.job.progress.completion)}% voltooid
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {printer.temperature?.bed && (
                      <Box mt={2}>
                        <Typography variant="caption" color="text.secondary">
                          Bed: {Math.round(printer.temperature.bed.actual)}°C / {Math.round(printer.temperature.bed.target)}°C
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Statistics */}
        <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
          Statistieken
        </Typography>
        
        <Grid container spacing={3}>
          {/* Queue Stats */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Queue color="primary" />
                    <Typography variant="h6" ml={1}>
                      Print Wachtrij
                    </Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="h4" color="primary">
                        {queueStats.queued || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        In Wachtrij
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h4" color="success.main">
                        {queueStats.printing || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Aan het Printen
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h4">
                        {queueStats.myJobs || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Mijn Jobs
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h4">
                        {queueStats.completed || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Voltooid
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>

          {/* User Stats */}
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <CloudUpload color="primary" />
                    <Typography variant="h6" ml={1}>
                      Mijn Activiteit
                    </Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="h4" color="primary">
                        {userStats.total_jobs || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Totaal Jobs
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h4" color="success.main">
                        {userStats.completed_jobs || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Voltooid
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h4">
                        {userStats.favorites_count || 0}/10
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Favorieten
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="h4">
                        {Math.round((userStats.total_print_time || 0) / 60)}h
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Print Tijd
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        </Grid>
      </motion.div>
    </Container>
  );
};

export default DashboardPage;
