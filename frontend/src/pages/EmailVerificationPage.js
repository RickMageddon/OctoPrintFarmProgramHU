import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
} from '@mui/material';
import { Email, CheckCircle } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const EmailVerificationPage = () => {
  const { verifyEmail, verifyCode } = useAuth();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = ['HU Email Invoeren', 'Verificatiecode Invoeren', 'Voltooid'];

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.endsWith('@hu.nl') && !email.endsWith('@student.hu.nl')) {
      setError('Alleen @hu.nl en @student.hu.nl email adressen zijn toegestaan');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await verifyEmail(email);
      setToken(response.token);
      setStep(1);
      toast.success('Verificatiecode verzonden naar je email!');
    } catch (err) {
      setError(err.error || 'Fout bij versturen verificatiecode');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      setError('Verificatiecode moet 6 cijfers zijn');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await verifyCode(token, code);
      setStep(2);
      toast.success('Email succesvol geverifieerd!');
      
      // Redirect to dashboard after success
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      setError(err.error || 'Ongeldige verificatiecode');
    } finally {
      setLoading(false);
    }
  };

  const extractNameFromEmail = (emailAddress) => {
    const parts = emailAddress.split('@')[0].split('.');
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box textAlign="center" mb={4}>
          <Email color="primary" sx={{ fontSize: 64 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            HU Email Verificatie
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Verifieer je Hogeschool Utrecht email adres om toegang te krijgen
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
          <Stepper activeStep={step} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {step === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleEmailSubmit}>
                <Typography variant="h6" gutterBottom>
                  Voer je HU email adres in
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  We sturen een verificatiecode naar je @hu.nl of @student.hu.nl email adres
                </Typography>
                
                <TextField
                  fullWidth
                  label="HU Email Adres"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="jouw.naam@student.hu.nl"
                  sx={{ mb: 3 }}
                />

                {email && (email.endsWith('@hu.nl') || email.endsWith('@student.hu.nl')) && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Je naam wordt opgeslagen als: <strong>{extractNameFromEmail(email)}</strong>
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || !email}
                  startIcon={loading ? <CircularProgress size={20} /> : <Email />}
                >
                  {loading ? 'Versturen...' : 'Verificatiecode Versturen'}
                </Button>
              </form>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleCodeSubmit}>
                <Typography variant="h6" gutterBottom>
                  Voer verificatiecode in
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  We hebben een 6-cijferige code gestuurd naar <strong>{email}</strong>
                </Typography>
                
                <TextField
                  fullWidth
                  label="Verificatiecode"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading}
                  placeholder="123456"
                  inputProps={{ 
                    style: { 
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      letterSpacing: '0.5rem'
                    }
                  }}
                  sx={{ mb: 3 }}
                />

                <Box display="flex" gap={2}>
                  <Button
                    variant="outlined"
                    onClick={() => setStep(0)}
                    disabled={loading}
                    fullWidth
                  >
                    Terug
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading || code.length !== 6}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                  >
                    {loading ? 'Verifiëren...' : 'Verifiëren'}
                  </Button>
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>
                  De code is 10 minuten geldig
                </Typography>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Box textAlign="center">
                <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Email Succesvol Geverifieerd!
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Je wordt doorgestuurd naar het dashboard...
                </Typography>
                <CircularProgress />
              </Box>
            </motion.div>
          )}
        </Paper>
      </motion.div>
    </Container>
  );
};

export default EmailVerificationPage;
