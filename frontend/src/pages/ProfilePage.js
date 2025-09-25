import React, { useState, useEffect, useContext } from 'react';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    Box,
    Avatar,
    Chip,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Alert,
    LinearProgress,
    Paper,
    IconButton
} from '@mui/material';
import {
    Person,
    School,
    Print,
    AccessTime,
    CheckCircle,
    Error,
    Edit,
    GitHub,
    Email,
    Settings,
    CloudUpload,
    History,
    TrendingUp
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const ProfilePage = () => {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [recentPrints, setRecentPrints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editDialog, setEditDialog] = useState(false);
    const [editForm, setEditForm] = useState({});

    // Fetch profile data
    const fetchProfile = async () => {
        try {
            setLoading(true);
            
            // Try to fetch real data
            try {
                const [profileRes, statsRes, historyRes] = await Promise.all([
                    axios.get('/api/users/profile'),
                    axios.get('/api/users/stats'),
                    axios.get('/api/users/history')
                ]);
                
                setProfile(profileRes.data);
                setStats(statsRes.data);
                setRecentPrints(historyRes.data.recent || []);
            } catch (apiError) {
                console.error('API Error:', apiError);
                setError('Kon profiel gegevens niet laden van de server');
                
                // Alleen basis user info zonder fake statistieken
                setProfile({
                    id: user?.id,
                    username: user?.username,
                    email: user?.email,
                    study_direction: user?.study_direction,
                    github_id: user?.github_id,
                    avatar_url: user?.avatar_url,
                    created_at: user?.created_at,
                    last_login: user?.last_login
                });

                // Lege statistieken - geen fake data
                setStats({
                    total_prints: 0,
                    successful_prints: 0,
                    failed_prints: 0,
                    total_print_time: 0,
                    total_filament_used: 0,
                    average_print_time: 0,
                    success_rate: 0
                });

                setRecentPrints([]);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setError('Kon profiel niet laden');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [user]);

    const handleEdit = () => {
        setEditForm({
            study_direction: profile.study_direction,
            email: profile.email
        });
        setEditDialog(true);
    };

    const handleSave = async () => {
        try {
            await axios.put('/api/users/profile', editForm);
            setProfile({ ...profile, ...editForm });
            setEditDialog(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            setError('Kon profiel niet bijwerken');
        }
    };

    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}u ${mins}m` : `${mins}m`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('nl-NL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'success';
            case 'failed': return 'error';
            case 'cancelled': return 'default';
            default: return 'primary';
        }
    };

    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Typography>Profiel laden...</Typography>
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
                    <Person sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Mijn Profiel
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Beheer je account en bekijk je print statistieken
                        </Typography>
                    </Box>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {/* Profile Information */}
                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Avatar
                                    src={profile?.avatar_url}
                                    sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
                                >
                                    <Person sx={{ fontSize: 60 }} />
                                </Avatar>
                                <Typography variant="h5" gutterBottom>
                                    {profile?.username}
                                </Typography>
                                <Chip
                                    icon={<School />}
                                    label={profile?.study_direction}
                                    color="primary"
                                    sx={{ mb: 2 }}
                                />
                                <Box display="flex" flexDirection="column" gap={1} alignItems="center">
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Email sx={{ fontSize: 20 }} />
                                        <Typography variant="body2">
                                            {profile?.email}
                                        </Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <GitHub sx={{ fontSize: 20 }} />
                                        <Typography variant="body2">
                                            {profile?.github_id}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button
                                    variant="outlined"
                                    startIcon={<Edit />}
                                    onClick={handleEdit}
                                    sx={{ mt: 2 }}
                                    fullWidth
                                >
                                    Profiel Bewerken
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Account Info */}
                        <Card sx={{ mt: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Account Informatie
                                </Typography>
                                <List dense>
                                    <ListItem>
                                        <ListItemText
                                            primary="Lid sinds"
                                            secondary={formatDate(profile?.created_at)}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="Laatste login"
                                            secondary={formatDate(profile?.last_login)}
                                        />
                                    </ListItem>
                                </List>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Statistics */}
                    <Grid item xs={12} md={8}>
                        <Card>
                            <CardContent>
                                <Box display="flex" alignItems="center" mb={3}>
                                    <TrendingUp sx={{ mr: 2, color: 'primary.main' }} />
                                    <Typography variant="h6">
                                        Print Statistieken
                                    </Typography>
                                </Box>
                                
                                <Grid container spacing={3}>
                                    <Grid item xs={6} sm={3}>
                                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                                            <Typography variant="h4" color="primary">
                                                {stats?.total_prints || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Totaal Prints
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                                            <Typography variant="h4" color="success.main">
                                                {stats?.successful_prints || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Succesvol
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                                            <Typography variant="h4" color="error.main">
                                                {stats?.failed_prints || 0}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Mislukt
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                                            <Typography variant="h4" color="info.main">
                                                {stats?.success_rate?.toFixed(1) || 0}%
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Succes Ratio
                                            </Typography>
                                        </Paper>
                                    </Grid>
                                </Grid>

                                <Divider sx={{ my: 3 }} />

                                <Grid container spacing={3}>
                                    <Grid item xs={12} sm={6}>
                                        <Box display="flex" alignItems="center" gap={2}>
                                            <AccessTime color="primary" />
                                            <Box>
                                                <Typography variant="h6">
                                                    {formatTime(stats?.total_print_time || 0)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Totale Print Tijd
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Box display="flex" alignItems="center" gap={2}>
                                            <CloudUpload color="primary" />
                                            <Box>
                                                <Typography variant="h6">
                                                    {stats?.total_filament_used?.toFixed(1) || 0}g
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Filament Gebruikt
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>

                        {/* Recent Prints */}
                        <Card sx={{ mt: 3 }}>
                            <CardContent>
                                <Box display="flex" alignItems="center" mb={3}>
                                    <History sx={{ mr: 2, color: 'primary.main' }} />
                                    <Typography variant="h6">
                                        Recente Prints
                                    </Typography>
                                </Box>
                                
                                {recentPrints.length === 0 ? (
                                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                        Nog geen prints uitgevoerd
                                    </Typography>
                                ) : (
                                    <List>
                                        {recentPrints.map((print, index) => (
                                            <ListItem key={print.id} divider={index < recentPrints.length - 1}>
                                                <ListItemIcon>
                                                    {print.status === 'completed' ? (
                                                        <CheckCircle color="success" />
                                                    ) : (
                                                        <Error color="error" />
                                                    )}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={print.filename}
                                                    secondary={
                                                        <Box>
                                                            <Typography variant="body2" component="span">
                                                                {formatTime(print.print_time)} • {formatDate(print.completed_at)}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                />
                                                <Chip
                                                    label={print.status === 'completed' ? 'Voltooid' : 'Mislukt'}
                                                    color={getStatusColor(print.status)}
                                                    size="small"
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </motion.div>

            {/* Edit Dialog */}
            <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Profiel Bewerken</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            fullWidth
                            label="Studierichting"
                            value={editForm.study_direction || ''}
                            onChange={(e) => setEditForm({ ...editForm, study_direction: e.target.value })}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="E-mail"
                            type="email"
                            value={editForm.email || ''}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialog(false)}>
                        Annuleren
                    </Button>
                    <Button onClick={handleSave} variant="contained">
                        Opslaan
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default ProfilePage;
