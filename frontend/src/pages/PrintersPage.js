import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    Box,
    Chip,
    Button,
    LinearProgress,
    IconButton,
    Paper,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Alert
} from '@mui/material';
import {
    Print,
    Settings,
    Thermostat,
    Speed,
    Layers,
    Memory,
    Wifi,
    CheckCircle,
    Error,
    Warning,
    PlayArrow,
    Pause,
    Stop,
    Home,
    Update
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import axios from 'axios';

const PrintersPage = () => {
    const { user } = useAuth();
    const [printers, setPrinters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch printer data from OctoPrint instances
    const fetchPrinters = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/printers/status');
            setPrinters(response.data || []);
        } catch (error) {
            console.error('Error fetching printers:', error);
            setError('Kon printer informatie niet laden van OctoPrint servers');
            setPrinters([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrinters();
        // Refresh every 30 seconds
        const interval = setInterval(fetchPrinters, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (printer) => {
        if (printer?.maintenance) return 'warning';
        const state = printer?.state;
        if (!state?.text) return 'default';
        switch (state.text.toLowerCase()) {
            case 'operational': return 'success';
            case 'printing': return 'primary';
            case 'paused': return 'warning';
            case 'error': return 'error';
            case 'offline': return 'default';
            default: return 'default';
        }
    };

    const getStatusIcon = (printer) => {
        if (printer?.maintenance) return <Settings color="warning" />;
        const state = printer?.state;
        if (!state?.text) return <Error />;
        switch (state.text.toLowerCase()) {
            case 'operational': return <CheckCircle color="success" />;
            case 'printing': return <Print color="primary" />;
            case 'paused': return <Pause color="warning" />;
            case 'error': return <Error color="error" />;
            case 'offline': return <Error color="disabled" />;
            default: return <Warning />;
        }
    };

    const getStatusText = (printer) => {
        if (printer?.maintenance) return 'Maintenance';
        return printer?.state?.text || 'Unknown';
    };

    const formatTemp = (temp) => {
        return temp ? `${Math.round(temp.actual)}°C / ${Math.round(temp.target)}°C` : 'N/A';
    };

    const handlePrinterAction = async (printerId, action) => {
        try {
            if (action === 'settings') {
                // Special handling for settings - open OctoPrint interface
                const response = await axios.post(`/api/printers/${printerId}/${action}`);
                if (response.data.success && response.data.url) {
                    window.open(response.data.url, '_blank');
                }
            } else {
                await axios.post(`/api/printers/${printerId}/${action}`);
                // Refresh data after action
                setTimeout(fetchPrinters, 1000);
            }
        } catch (error) {
            console.error(`Error ${action}:`, error);
            setError(`Kon ${action} niet uitvoeren op printer`);
        }
    };

    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Typography>Printer informatie laden...</Typography>
                <LinearProgress sx={{ mt: 2 }} />
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
                <Box display="flex" alignItems="center" mb={4}>
                    <Print sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            3D Printers
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Beheer en monitor alle 3D printers in de farm
                        </Typography>
                    </Box>
                    <Box ml="auto">
                        <Button
                            variant="outlined"
                            onClick={fetchPrinters}
                            startIcon={<Update />}
                        >
                            Vernieuwen
                        </Button>
                    </Box>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {printers.length === 0 ? (
                        <Grid item xs={12}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                                    <Print sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Geen printers gevonden
                                    </Typography>
                                    <Typography color="text.secondary">
                                        Controleer of de OctoPrint servers draaien
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ) : (
                        printers.map((printer, index) => (
                            <Grid item xs={12} lg={6} key={printer.id || index}>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.1 }}
                                >
                                    <Card sx={{ height: '100%' }}>
                                        <CardContent>
                                            {/* Printer Header */}
                                            <Box display="flex" alignItems="center" mb={3}>
                                                <Box display="flex" alignItems="center" flex={1}>
                                                    {getStatusIcon(printer)}
                                                    <Box ml={2}>
                                                        <Typography variant="h6">
                                                            {printer.name || `Printer ${index + 1}`}
                                                        </Typography>
                                                        <Chip
                                                            label={getStatusText(printer)}
                                                            color={getStatusColor(printer)}
                                                            size="small"
                                                        />
                                                    </Box>
                                                </Box>
                                                <Box>
                                                    {printer.state?.text === 'Operational' && (
                                                        <IconButton
                                                            onClick={() => handlePrinterAction(printer.id, 'home')}
                                                            title="Home alle assen"
                                                        >
                                                            <Home />
                                                        </IconButton>
                                                    )}
                                                    {printer.state?.text === 'Printing' && (
                                                        <>
                                                            <IconButton
                                                                onClick={() => handlePrinterAction(printer.id, 'pause')}
                                                                color="warning"
                                                                title="Pauzeer print"
                                                            >
                                                                <Pause />
                                                            </IconButton>
                                                            <IconButton
                                                                onClick={() => handlePrinterAction(printer.id, 'cancel')}
                                                                color="error"
                                                                title="Stop print"
                                                            >
                                                                <Stop />
                                                            </IconButton>
                                                        </>
                                                    )}
                                                    {printer.state?.text === 'Paused' && (
                                                        <IconButton
                                                            onClick={() => handlePrinterAction(printer.id, 'resume')}
                                                            color="success"
                                                            title="Hervat print"
                                                        >
                                                            <PlayArrow />
                                                        </IconButton>
                                                    )}
                                                    {user?.is_admin && (
                                                        <IconButton
                                                            onClick={() => handlePrinterAction(printer.id, 'settings')}
                                                            title="Printer instellingen"
                                                        >
                                                            <Settings />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </Box>

                                            {/* Current Job Info */}
                                            {printer.job?.job?.file?.name && (
                                                <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        Huidige Print: {printer.job.job.file.name}
                                                    </Typography>
                                                    {printer.job.progress?.completion !== null && (
                                                        <Box mt={2}>
                                                            <Box display="flex" justifyContent="space-between" mb={1}>
                                                                <Typography variant="body2">
                                                                    Voortgang: {Math.round(printer.job.progress.completion)}%
                                                                </Typography>
                                                                {printer.job.progress.printTimeLeft && (
                                                                    <Typography variant="body2">
                                                                        Tijd over: {Math.round(printer.job.progress.printTimeLeft / 60)}m
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={printer.job.progress.completion}
                                                                sx={{ 
                                                                    height: 8, 
                                                                    borderRadius: 4,
                                                                    backgroundColor: 'rgba(255,255,255,0.3)',
                                                                    '& .MuiLinearProgress-bar': {
                                                                        backgroundColor: 'white'
                                                                    }
                                                                }}
                                                            />
                                                        </Box>
                                                    )}
                                                </Paper>
                                            )}

                                            {/* Temperature Info */}
                                            <Box mb={3}>
                                                <Typography variant="h6" gutterBottom>
                                                    <Thermostat sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                    Temperaturen
                                                </Typography>
                                                <Grid container spacing={2}>
                                                    {printer.temperature?.bed && (
                                                        <Grid item xs={6}>
                                                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Heated Bed
                                                                </Typography>
                                                                <Typography variant="h6">
                                                                    {formatTemp(printer.temperature.bed)}
                                                                </Typography>
                                                            </Paper>
                                                        </Grid>
                                                    )}
                                                    {printer.temperature?.tool0 && (
                                                        <Grid item xs={6}>
                                                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Hotend
                                                                </Typography>
                                                                <Typography variant="h6">
                                                                    {formatTemp(printer.temperature.tool0)}
                                                                </Typography>
                                                            </Paper>
                                                        </Grid>
                                                    )}
                                                </Grid>
                                            </Box>

                                            {/* System Info */}
                                            <Divider sx={{ my: 2 }} />
                                            <Typography variant="h6" gutterBottom>
                                                <Memory sx={{ mr: 1, verticalAlign: 'middle' }} />
                                                Systeem Informatie
                                            </Typography>
                                            <List dense>
                                                {printer.connection?.current?.state && (
                                                    <ListItem>
                                                        <ListItemIcon>
                                                            <Wifi />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary="Verbinding"
                                                            secondary={printer.connection.current.state}
                                                        />
                                                    </ListItem>
                                                )}
                                                {printer.connection?.current?.baudrate && (
                                                    <ListItem>
                                                        <ListItemIcon>
                                                            <Speed />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary="Baudrate"
                                                            secondary={`${printer.connection.current.baudrate} bps`}
                                                        />
                                                    </ListItem>
                                                )}
                                                {printer.version && (
                                                    <ListItem>
                                                        <ListItemIcon>
                                                            <Layers />
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary="OctoPrint Versie"
                                                            secondary={printer.version}
                                                        />
                                                    </ListItem>
                                                )}
                                            </List>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </Grid>
                        ))
                    )}
                </Grid>
            </motion.div>
        </Container>
    );
};

export default PrintersPage;
