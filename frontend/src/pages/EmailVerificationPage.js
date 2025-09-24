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
  Chip,
} from '@mui/material';
import { Email, CheckCircle, GitHub } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import GitHubDeviceFlow from '../components/GitHubDeviceFlow';

const EmailVerificationPage = () => {
  const { verifyEmail, verifyCode } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDeviceFlow, setShowDeviceFlow] = useState(false);

  const steps = ['HU Email Invoeren', 'Verificatiecode Invoeren', 'GitHub Koppelen'];

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.endsWith('@hu.nl') && !email.endsWith('@student.hu.nl')) {
      setError('Alleen @hu.nl en @student.hu.nl email adressen zijn toegestaan');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // For new registration, call the register endpoint directly
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setStep(1);
      toast.success('Verificatiecode verzonden naar je email!');
    } catch (err) {
      setError(err.message || 'Fout bij versturen verificatiecode');
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
      // For new registration, call the verify-registration endpoint directly
      const response = await fetch('/api/auth/verify-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email,
          code: code
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setStep(2);
      toast.success('Email succesvol geverifieerd!');
    } catch (err) {
      setError(err.message || 'Ongeldige verificatiecode');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLink = () => {
    // Start Device Flow instead of redirect
    setShowDeviceFlow(true);
  };

  const handleDeviceFlowSuccess = (userData, redirectPath) => {
    // User successfully linked GitHub account
    toast.success('GitHub account succesvol gekoppeld!');
    navigate(redirectPath || '/dashboard');
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
            Account Registratie
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Maak je Printmeister account aan in 3 eenvoudige stappen
          </Typography>
        </Box>

        <Paper elevation={8} sx={{ p: 6, maxWidth: 600, mx: 'auto' }}>
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

          {/* Step 1: Email Input */}
          {step === 0 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box component="form" onSubmit={handleEmailSubmit}>
                <Typography variant="h6" gutterBottom>
                  Stap 1: HU Email Adres
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Voer je Hogeschool Utrecht email adres in om te beginnen
                </Typography>

                <TextField
                  fullWidth
                  label="HU Email Adres"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="jouw.naam@hu.nl of jouw.naam@student.hu.nl"
                  sx={{ mb: 3 }}
                />

                <Box display="flex" gap={2}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/login')}
                    disabled={loading}
                    sx={{ flex: 1 }}
                  >
                    Terug naar Login
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || !email}
                    sx={{ flex: 1 }}
                  >
                    {loading ? <CircularProgress size={20} /> : 'Verstuur Verificatiecode'}
                  </Button>
                </Box>
              </Box>
            </motion.div>
          )}

          {/* Step 2: Code Verification */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box component="form" onSubmit={handleCodeSubmit}>
                <Typography variant="h6" gutterBottom>
                  Stap 2: Email Verificatie
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  We hebben een 6-cijferige verificatiecode gestuurd naar:
                </Typography>

                <Chip 
                  label={email}
                  color="primary" 
                  variant="outlined"
                  icon={<Email />}
                  sx={{ mb: 3 }}
                />

                <TextField
                  fullWidth
                  label="Verificatiecode"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  placeholder="123456"
                  inputProps={{
                    maxLength: 6,
                    style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }
                  }}
                  sx={{ mb: 3 }}
                />

                <Box display="flex" gap={2}>
                  <Button
                    variant="outlined"
                    onClick={() => setStep(0)}
                    disabled={loading}
                    sx={{ flex: 1 }}
                  >
                    Terug
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || code.length !== 6}
                    sx={{ flex: 1 }}
                  >
                    {loading ? <CircularProgress size={20} /> : 'Verifieer Code'}
                  </Button>
                </Box>
              </Box>
            </motion.div>
          )}

          {/* Step 3: GitHub Linking */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Box textAlign="center">
                <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" color="success.main" gutterBottom>
                  Email Geverifieerd!
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Welkom {extractNameFromEmail(email)}! Nu koppelen we je GitHub account.
                </Typography>

                <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                  <Typography variant="body2">
                    <strong>Belangrijk:</strong> Zorg ervoor dat je GitHub account gekoppeld is aan 
                    hetzelfde HU email adres ({email}) en dat dit email adres geverifieerd is in GitHub.
                  </Typography>
                </Alert>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={<GitHub />}
                  onClick={handleGitHubLink}
                  sx={{ mb: 3 }}
                  fullWidth
                >
                  Koppel GitHub Account
                </Button>

                <Typography variant="caption" color="text.secondary">
                  Door te klikken ga je naar GitHub om je account te koppelen
                </Typography>
              </Box>
            </motion.div>
          )}
        </Paper>

        {/* GitHub Device Flow Dialog */}
        <GitHubDeviceFlow
          open={showDeviceFlow}
          onClose={() => setShowDeviceFlow(false)}
          onSuccess={handleDeviceFlowSuccess}
        />
      </motion.div>
    </Container>
  );
};

export default EmailVerificationPage;