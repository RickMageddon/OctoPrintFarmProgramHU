import React, { useState, useEffect, useRef } from 'react';
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
import { Alert, Button, TextField, Select, MenuItem, InputLabel, FormControl, Checkbox, FormControlLabel, Snackbar, Paper } from '@mui/material';
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
  // Upload/print form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [printer, setPrinter] = useState('auto');
  const [priority, setPriority] = useState('normal');
  const [filamentChange, setFilamentChange] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const fileInputRef = useRef();
  // Upload/print form handlers
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null);
    setSubmitError('');
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleSubmitPrintJob = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    if (!selectedFile) {
      setSubmitError('Selecteer een G-code bestand.');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('printer', printer);
    formData.append('priority', priority);
    formData.append('filamentChange', filamentChange);
    formData.append('notes', notes);
    try {
      // 1. Upload file
      const uploadRes = await axios.post('/api/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileId = uploadRes.data.file.id; // Get the correct ID from the upload response
      // 2. Voeg toe aan queue
      const queueRes = await axios.post('/api/queue/add', {
        favoriteId: fileId, // Use favoriteId instead of fileId to match backend expectation
        printer,
        priority,
        filamentChange,
        notes,
      });
      setSubmitSuccess('Printopdracht succesvol toegevoegd aan de wachtrij!');
      setShowUploadForm(false);
      setSelectedFile(null);
      setNotes('');
      setFilamentChange(false);
      setPriority('normal');
      setPrinter('auto');
      fetchDashboardData();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setSubmitError(err.response.data.error);
      } else {
        setSubmitError('Er is een fout opgetreden bij het toevoegen van de printopdracht.');
      }
    }
  };

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
      const [printersResponse, queueResponse, userStatsResponse] = await Promise.all([
        axios.get('/api/printers/status'),
        axios.get('/api/queue'),
        axios.get('/api/users/stats'),
      ]);

      console.log('Dashboard printer status response:', printersResponse.data);
      console.log('First printer state structure:', printersResponse.data[0]?.state);
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
      
      setUserStats(userStatsResponse.data);
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

  const getStatusIcon = (state) => {
    if (!state?.text) return <Error color="disabled" />;
    switch (state.text.toLowerCase()) {
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

  const getStatusColor = (state) => {
    if (!state?.text) return 'default';
    switch (state.text.toLowerCase()) {
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

        {/* Quick Actions */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              color: 'white',
              '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.3s' }
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      🚀 Snel Printen
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Upload direct een bestand en start printen
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    color="secondary" 
                    onClick={() => setShowUploadForm(v => !v)}
                    size="large"
                  >
                    {showUploadForm ? 'Sluiten' : 'Upload'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
              color: 'white',
              '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.3s' }
            }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      📺 Live Monitor
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Bekijk realtime printer status
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained" 
                    color="secondary" 
                    onClick={() => window.open('/live-monitor', '_blank')}
                    size="large"
                  >
                    Bekijken
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Upload/Print Form Section */}
        {showUploadForm && (
          <Paper elevation={3} sx={{ p: 3, mb: 4, background: 'rgba(255,255,255,0.95)', borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={600} mb={1}>📁 Nieuw Printbestand Uploaden</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Upload je G-code bestand en configureer je printopdracht
            </Typography>
            <Box component="form" onSubmit={handleSubmitPrintJob}>
              {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
              {submitSuccess && <Alert severity="success" sx={{ mb: 2 }}>{submitSuccess}</Alert>}
              <Grid container spacing={3}>
                {/* File upload */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" fontWeight={600} mb={1}>📁 Bestand Selecteren</Typography>
                  <Button variant="outlined" fullWidth onClick={handleUploadClick} sx={{ mb: 1 }}>
                    {selectedFile ? selectedFile.name : 'Kies G-code bestand'}
                  </Button>
                  <input type="file" accept=".gcode,.g" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                  {selectedFile && (
                    <Typography variant="caption" color="text.secondary">{(selectedFile.size/1024/1024).toFixed(2)} MB</Typography>
                  )}
                </Grid>
                {/* Print settings */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" fontWeight={600} mb={1}>🖨️ Printer Selectie</Typography>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="printer-select-label">Printer</InputLabel>
                    <Select labelId="printer-select-label" value={printer} label="Printer" onChange={e => setPrinter(e.target.value)}>
                      <MenuItem value="auto">Automatisch toewijzen (aanbevolen)</MenuItem>
                      {printerStatus.map(p => (
                        <MenuItem key={p.id} value={p.id} disabled={p.state?.text !== 'Operational'}>
                          {p.name} {p.state?.text !== 'Operational' ? `(${p.state?.text})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="subtitle1" fontWeight={600} mb={1}>📊 Prioriteit</Typography>
                  <FormControl fullWidth>
                    <InputLabel id="priority-select-label">Prioriteit</InputLabel>
                    <Select labelId="priority-select-label" value={priority} label="Prioriteit" onChange={e => setPriority(e.target.value)}>
                      <MenuItem value="normal">Normaal (standaard)</MenuItem>
                      <MenuItem value="high">Hoog (spoed)</MenuItem>
                      <MenuItem value="low">Laag (flexibel)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {/* Filament & options */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle1" fontWeight={600} mb={1}>🎨 Filament & Opties</Typography>
                  <FormControlLabel
                    control={<Checkbox checked={filamentChange} onChange={e => setFilamentChange(e.target.checked)} />}
                    label={<span>Filament wisselen vereist</span>}
                  />
                  <TextField
                    label="Opmerkingen (optioneel)"
                    multiline
                    minRows={2}
                    fullWidth
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    sx={{ mt: 2 }}
                  />
                  <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 3 }}>
                    🚀 Printopdracht Toevoegen aan Wachtrij
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        )}
        <Typography variant="body1" color="text.secondary" mb={4}>
          Welkom terug, {user.username}! Hier is een overzicht van Printmeister.
        </Typography>

        {/* Printer Status */}
        <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
          Printer Status
        </Typography>
        
        <Grid container spacing={3} mb={4}>
          {printerStatus.map((printer, index) => {
          console.log(`Dashboard printer ${index + 1}:`, { 
            name: printer.name, 
            state: printer.state, 
            stateText: printer.state?.text,
            fullPrinter: printer 
          });
          return (
            <Grid item xs={12} md={4} key={printer.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      {getStatusIcon(printer.state)}
                      <Typography variant="h6" ml={1}>
                        {printer.name}
                      </Typography>
                    </Box>
                    
                    <Chip
                      label={printer.state?.text || 'Offline'}
                      color={getStatusColor(printer.state)}
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
          );
        })}
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
