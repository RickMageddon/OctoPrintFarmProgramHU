import React, { useState, useEffect } from 'react';
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Alert
} from '@mui/material';
import {
    PlayArrow,
    Pause,
    Delete,
    Edit,
    FileUpload,
    Queue as QueueIcon,
    Person,
    Schedule,
    Flag
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import axios from 'axios';

const QueuePage = () => {
    const [queueItems, setQueueItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editDialog, setEditDialog] = useState({ open: false, item: null });

    // Fetch queue data
    const fetchQueue = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/queue');
            setQueueItems(response.data.queue || []);
        } catch (error) {
            console.error('Error fetching queue:', error);
            setError('Kon wachtrij niet laden van de server');
            setQueueItems([]); // Lege wachtrij in plaats van demo data
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
        // Refresh every 30 seconds
        const interval = setInterval(fetchQueue, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'printing': return 'success';
            case 'queued': return 'primary';
            case 'completed': return 'info';
            case 'failed': return 'error';
            case 'cancelled': return 'default';
            default: return 'default';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'printing': return 'Aan het printen';
            case 'queued': return 'In wachtrij';
            case 'completed': return 'Voltooid';
            case 'failed': return 'Mislukt';
            case 'cancelled': return 'Geannuleerd';
            default: return status;
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#f44336';
            case 'normal': return '#ff9800';
            case 'low': return '#4caf50';
            default: return '#757575';
        }
    };

    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}u ${mins}m` : `${mins}m`;
    };

    const handleAction = async (action, itemId) => {
        try {
            await axios.post(`/api/queue/${itemId}/${action}`);
            fetchQueue(); // Refresh data
        } catch (error) {
            console.error(`Error ${action}:`, error);
            setError(`Kon ${action} niet uitvoeren`);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Box display="flex" alignItems="center" mb={4}>
                    <QueueIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Print Wachtrij
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Beheer alle printopdrachten en hun status
                        </Typography>
                    </Box>
                    <Box ml="auto">
                        <Button
                            variant="contained"
                            startIcon={<FileUpload />}
                            onClick={() => window.location.href = '/files'}
                            sx={{ mr: 2 }}
                        >
                            Nieuw Bestand
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={fetchQueue}
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
                    {loading ? (
                        <Grid item xs={12}>
                            <Card>
                                <CardContent>
                                    <Typography>Wachtrij laden...</Typography>
                                    <LinearProgress sx={{ mt: 2 }} />
                                </CardContent>
                            </Card>
                        </Grid>
                    ) : queueItems.length === 0 ? (
                        <Grid item xs={12}>
                            <Card>
                                <CardContent sx={{ textAlign: 'center', py: 6 }}>
                                    <QueueIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Geen items in de wachtrij
                                    </Typography>
                                    <Typography color="text.secondary" paragraph>
                                        Upload een bestand om te beginnen met printen
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        startIcon={<FileUpload />}
                                        onClick={() => window.location.href = '/files'}
                                    >
                                        Bestand Uploaden
                                    </Button>
                                </CardContent>
                            </Card>
                        </Grid>
                    ) : (
                        queueItems.map((item, index) => (
                            <Grid item xs={12} key={item.id}>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.1 }}
                                >
                                    <Card
                                        sx={{
                                            border: item.status === 'printing' ? 2 : 1,
                                            borderColor: item.status === 'printing' ? 'success.main' : 'divider',
                                            '&:hover': { boxShadow: 4 }
                                        }}
                                    >
                                        <CardContent>
                                            <Box display="flex" alignItems="center" mb={2}>
                                                <Box
                                                    sx={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: '50%',
                                                        backgroundColor: 'primary.main',
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 'bold',
                                                        mr: 2
                                                    }}
                                                >
                                                    #{index + 1}
                                                </Box>
                                                <Box flex={1}>
                                                    <Typography variant="h6" gutterBottom>
                                                        {item.filename}
                                                    </Typography>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Person sx={{ fontSize: 16 }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {item.user.username} ({item.user.study_direction})
                                                        </Typography>
                                                        <Schedule sx={{ fontSize: 16, ml: 2 }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            ~{formatTime(item.estimated_time)}
                                                        </Typography>
                                                        <Flag sx={{ fontSize: 16, ml: 2, color: getPriorityColor(item.priority) }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {item.priority} prioriteit
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Chip
                                                        label={getStatusText(item.status)}
                                                        color={getStatusColor(item.status)}
                                                        variant={item.status === 'printing' ? 'filled' : 'outlined'}
                                                    />
                                                    {item.printer_id && (
                                                        <Chip
                                                            label={`Printer ${item.printer_id}`}
                                                            variant="outlined"
                                                            size="small"
                                                        />
                                                    )}
                                                </Box>
                                                <Box ml={2}>
                                                    {item.status === 'queued' && (
                                                        <>
                                                            <IconButton
                                                                onClick={() => handleAction('start', item.id)}
                                                                color="success"
                                                                title="Start printen"
                                                            >
                                                                <PlayArrow />
                                                            </IconButton>
                                                            <IconButton
                                                                onClick={() => setEditDialog({ open: true, item })}
                                                                color="primary"
                                                                title="Bewerken"
                                                            >
                                                                <Edit />
                                                            </IconButton>
                                                        </>
                                                    )}
                                                    {item.status === 'printing' && (
                                                        <IconButton
                                                            onClick={() => handleAction('pause', item.id)}
                                                            color="warning"
                                                            title="Pauzeren"
                                                        >
                                                            <Pause />
                                                        </IconButton>
                                                    )}
                                                    <IconButton
                                                        onClick={() => handleAction('cancel', item.id)}
                                                        color="error"
                                                        title="Annuleren"
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                            
                                            {item.status === 'printing' && (
                                                <Box>
                                                    <Box display="flex" justifyContent="space-between" mb={1}>
                                                        <Typography variant="body2">
                                                            Voortgang: {item.progress}%
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {formatTime(Math.floor((100 - item.progress) / 100 * item.estimated_time))} resterend
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={item.progress}
                                                        sx={{ height: 8, borderRadius: 4 }}
                                                    />
                                                </Box>
                                            )}
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

export default QueuePage;
