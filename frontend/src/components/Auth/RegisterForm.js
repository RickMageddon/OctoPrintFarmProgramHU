import React, { useState } from 'react';
import {
    Paper,
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    InputAdornment,
    Chip
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import VerifiedIcon from '@mui/icons-material/Verified';
import GitHubIcon from '@mui/icons-material/GitHub';

const steps = ['HU Email invoeren', 'Email verificatie', 'GitHub inloggen'];

const RegisterForm = ({ onSwitchToLogin }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const validateHUEmail = (email) => {
        return /^[^\s@]+@(student\.)?hu\.nl$/.test(email);
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!validateHUEmail(email)) {
            setError('Voer een geldig HU email adres in (@hu.nl of @student.hu.nl)');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            setSuccess(data.message);
            setActiveStep(1);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerificationSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (verificationCode.length !== 6) {
            setError('Verificatiecode moet 6 cijfers zijn');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/verify-registration', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, code: verificationCode })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Verification failed');
            }

            setSuccess(data.message);
            setActiveStep(2);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGitHubLogin = () => {
        window.location.href = '/api/auth/github';
    };

    const renderStepContent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <Box component="form" onSubmit={handleEmailSubmit} sx={{ mt: 2 }}>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Voer je HU email adres in om te beginnen met registreren
                        </Typography>
                        
                        <TextField
                            fullWidth
                            label="HU Email Adres"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            placeholder="naam@hu.nl of naam@student.hu.nl"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <EmailIcon color="primary" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 3 }}
                        />

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={onSwitchToLogin}
                                disabled={loading}
                                sx={{ flex: 1 }}
                            >
                                Terug naar inloggen
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={loading || !email}
                                sx={{ flex: 1 }}
                            >
                                {loading ? <CircularProgress size={20} /> : 'Verstuur verificatiecode'}
                            </Button>
                        </Box>
                    </Box>
                );

            case 1:
                return (
                    <Box component="form" onSubmit={handleVerificationSubmit} sx={{ mt: 2 }}>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                            We hebben een verificatiecode gestuurd naar:
                        </Typography>
                        
                        <Chip 
                            label={email} 
                            color="primary" 
                            variant="outlined" 
                            icon={<EmailIcon />}
                            sx={{ mb: 3 }}
                        />
                        
                        <TextField
                            fullWidth
                            label="Verificatiecode"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            disabled={loading}
                            placeholder="123456"
                            inputProps={{ 
                                maxLength: 6,
                                style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }
                            }}
                            sx={{ mb: 3 }}
                        />

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => setActiveStep(0)}
                                disabled={loading}
                                sx={{ flex: 1 }}
                            >
                                Terug
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={loading || verificationCode.length !== 6}
                                sx={{ flex: 1 }}
                            >
                                {loading ? <CircularProgress size={20} /> : 'Verifieer code'}
                            </Button>
                        </Box>
                    </Box>
                );

            case 2:
                return (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <VerifiedIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
                        
                        <Typography variant="h6" color="success.main" sx={{ mb: 2 }}>
                            Email succesvol geverifieerd!
                        </Typography>
                        
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                            Je kunt nu inloggen met je GitHub account. Zorg ervoor dat je GitHub account
                            gekoppeld is aan hetzelfde email adres.
                        </Typography>

                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<GitHubIcon />}
                            onClick={handleGitHubLogin}
                            sx={{ mb: 2 }}
                        >
                            Inloggen met GitHub
                        </Button>

                        <Box>
                            <Button
                                variant="text"
                                onClick={onSwitchToLogin}
                                size="small"
                            >
                                Terug naar login pagina
                            </Button>
                        </Box>
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
            <Typography variant="h4" component="h1" align="center" gutterBottom>
                Registreren
            </Typography>

            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {success}
                </Alert>
            )}

            {renderStepContent()}
        </Paper>
    );
};

export default RegisterForm;