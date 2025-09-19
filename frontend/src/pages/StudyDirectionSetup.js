import React, { useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Button,
    Box,
    Alert,
    CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { School, ArrowForward } from '@mui/icons-material';

const StudyDirectionSetup = () => {
    const [studyDirection, setStudyDirection] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { setStudyDirection: updateStudyDirection } = useAuth();

    const studyDirections = [
        { value: 'TI', label: 'Technische Informatica (TI)' },
        { value: 'CSC', label: 'Cyber Security & Cloud (CSC)' },
        { value: 'SD', label: 'Software Development (SD)' },
        { value: 'OPENICT', label: 'Open ICT' },
    { value: 'AI', label: 'Artificial Intelligence (AI)' },
    { value: 'BIM', label: 'Business IT Management (BIM)' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!studyDirection) {
            setError('Selecteer een studierichting');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await updateStudyDirection(studyDirection);
            navigate('/dashboard');
        } catch (error) {
            console.error('Error setting study direction:', error);
            setError(error.message || 'Er is een fout opgetreden bij het instellen van je studierichting');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Paper elevation={8} sx={{ p: 6 }}>
                    <Box textAlign="center" mb={4}>
                        <School color="primary" sx={{ fontSize: 60, mb: 2 }} />
                        <Typography variant="h4" component="h1" gutterBottom>
                            Studierichting instellen
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Kies je studierichting om toegang te krijgen tot Printmeister
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <FormControl component="fieldset" fullWidth sx={{ mb: 4 }}>
                            <FormLabel component="legend" sx={{ mb: 2, fontSize: '1.1rem', fontWeight: 600 }}>
                                Selecteer je studierichting:
                            </FormLabel>
                            <RadioGroup
                                value={studyDirection}
                                onChange={(e) => setStudyDirection(e.target.value)}
                                sx={{ gap: 1 }}
                            >
                                {studyDirections.map((direction) => (
                                    <FormControlLabel
                                        key={direction.value}
                                        value={direction.value}
                                        control={<Radio />}
                                        label={direction.label}
                                        sx={{
                                            border: '1px solid #e0e0e0',
                                            borderRadius: 2,
                                            m: 0,
                                            p: 1.5,
                                            '&:hover': {
                                                backgroundColor: '#f5f5f5',
                                            },
                                            '&.Mui-checked': {
                                                borderColor: 'primary.main',
                                                backgroundColor: 'primary.light',
                                                color: 'primary.contrastText',
                                            },
                                        }}
                                    />
                                ))}
                            </RadioGroup>
                        </FormControl>

                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <ArrowForward />}
                            disabled={loading || !studyDirection}
                            fullWidth
                            sx={{ py: 1.5 }}
                        >
                            {loading ? 'Bezig met instellen...' : 'Doorgaan naar Dashboard'}
                        </Button>
                    </form>

                    <Box mt={3} textAlign="center">
                        <Typography variant="caption" color="text.secondary">
                            Je kunt je studierichting later wijzigen in je profiel
                        </Typography>
                    </Box>
                </Paper>
            </motion.div>
        </Container>
    );
};

export default StudyDirectionSetup;