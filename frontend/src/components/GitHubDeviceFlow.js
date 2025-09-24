import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  TextField,
  Link,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip
} from '@mui/material';
import { GitHub, ContentCopy, CheckCircle, OpenInNew } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const GitHubDeviceFlow = ({ open, onClose, onSuccess }) => {
  const { startGitHubDeviceFlow, pollGitHubDeviceFlow, refreshUser } = useAuth();
  
  const [step, setStep] = useState(0);
  const [deviceData, setDeviceData] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  const steps = [
    'GitHub code aanvragen',
    'Code invoeren op GitHub',
    'Wachten op autorisatie'
  ];

  const resetFlow = () => {
    setStep(0);
    setDeviceData(null);
    setPolling(false);
    setError('');
    setTimeLeft(0);
    setCodeCopied(false);
  };

  const startFlow = async () => {
    try {
      setError('');
      setStep(1);
      
      const data = await startGitHubDeviceFlow();
      setDeviceData(data);
      setTimeLeft(data.expires_in);
      setStep(2);
      
      // Start countdown timer
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setError('Code is verlopen. Start opnieuw.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Don't auto-start polling - wait for user to click "Ik heb de code ingevoerd"

    } catch (err) {
      setError(err.message || 'Er is een fout opgetreden');
      setStep(0);
    }
  };

  const startPolling = async () => {
    if (polling) return;
    
    setPolling(true);
    setStep(3);
    
    const pollInterval = deviceData?.interval || 5;
    console.log('Starting polling every', pollInterval, 'seconds');
    
    const poll = async () => {
      try {
        console.log('🔄 Polling GitHub authorization...');
        const result = await pollGitHubDeviceFlow();
        console.log('Polling result:', result);
        
        if (result.status === 'success') {
          console.log('✅ GitHub authorization successful!');
          setPolling(false);
          
          // Refresh the user state in AuthContext
          await refreshUser();
          
          onSuccess(result.user, result.redirect);
          onClose();
          resetFlow();
          return;
        }
        
        if (result.status === 'pending') {
          // Continue polling
          console.log('⏳ Still pending, polling again in', pollInterval, 'seconds');
          setTimeout(poll, pollInterval * 1000);
        } else if (result.status === 'slow_down') {
          // Slow down polling
          console.log('⏳ Rate limited, slowing down, polling again in', pollInterval + 5, 'seconds');
          setTimeout(poll, (pollInterval + 5) * 1000);
        } else {
          console.log('❌ Unexpected status:', result.status);
          setPolling(false);
          setError('Onverwachte response van server');
        }
        
      } catch (err) {
        console.error('❌ Polling error:', err);
        setPolling(false);
        
        // Show more specific error messages
        let errorMessage = 'Autorisatie mislukt';
        if (err.error === 'no_verified_email') {
          errorMessage = 'Geen geverifieerd HU email gevonden in je GitHub account. Registreer eerst met je HU email.';
        } else if (err.error === 'github_already_linked') {
          errorMessage = 'Dit gebruikersaccount heeft al een GitHub account gekoppeld.';
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        setStep(2);
      }
    };
    
    // Start first poll
    setTimeout(poll, pollInterval * 1000);
  };

  const copyCode = async () => {
    if (deviceData?.user_code) {
      try {
        await navigator.clipboard.writeText(deviceData.user_code);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    }
  };

  const openGitHub = () => {
    if (deviceData?.verification_uri) {
      window.open(deviceData.verification_uri, '_blank');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <GitHub color="primary" />
          <Typography variant="h6">Inloggen met GitHub</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={step} orientation="vertical">
          <Step>
            <StepLabel>GitHub code aanvragen</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                We vragen een unieke code aan bij GitHub voor veilige authenticatie.
              </Typography>
              <Button
                variant="contained"
                onClick={startFlow}
                startIcon={<GitHub />}
                disabled={polling}
              >
                Code aanvragen
              </Button>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>Code invoeren op GitHub</StepLabel>
            <StepContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Ga naar GitHub en voer deze code in:
                </Typography>
                
                {deviceData && (
                  <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
                    <TextField
                      value={deviceData.user_code}
                      variant="outlined"
                      size="small"
                      InputProps={{
                        readOnly: true,
                        style: { 
                          fontFamily: 'monospace', 
                          fontSize: '1.2rem', 
                          fontWeight: 'bold',
                          letterSpacing: '0.1em'
                        }
                      }}
                      sx={{ minWidth: '140px' }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={copyCode}
                      startIcon={codeCopied ? <CheckCircle /> : <ContentCopy />}
                      color={codeCopied ? "success" : "primary"}
                    >
                      {codeCopied ? 'Gekopieerd!' : 'Kopieer'}
                    </Button>
                  </Box>
                )}

                <Button
                  variant="contained"
                  onClick={openGitHub}
                  startIcon={<OpenInNew />}
                  color="primary"
                  disabled={!deviceData}
                  sx={{ mb: 2 }}
                >
                  Open GitHub
                </Button>

                {timeLeft > 0 && (
                  <Chip
                    label={`Verloopt over: ${formatTime(timeLeft)}`}
                    variant="outlined"
                    size="small"
                    color="warning"
                  />
                )}
              </Box>

              <Button
                variant="outlined"
                onClick={startPolling}
                disabled={polling || !deviceData}
              >
                Ik heb de code ingevoerd
              </Button>
            </StepContent>
          </Step>

          <Step>
            <StepLabel>Wachten op autorisatie</StepLabel>
            <StepContent>
              <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Wachten op bevestiging van GitHub...
                </Typography>
              </Box>
              
              <Typography variant="caption" color="text.secondary">
                Dit gebeurt automatisch zodra je de app autoriseert op GitHub.
              </Typography>
            </StepContent>
          </Step>
        </Stepper>

        {step === 2 && deviceData && (
          <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
            <Typography variant="body2" color="text.secondary">
              <strong>Instructies:</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              1. Klik op "Open GitHub" of ga naar{' '}
              <Link href={deviceData.verification_uri} target="_blank" rel="noopener">
                {deviceData.verification_uri}
              </Link>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              2. Voer de code <strong>{deviceData.user_code}</strong> in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              3. Autoriseer de Printmeister applicatie
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={polling}>
          Annuleren
        </Button>
        {step === 0 && (
          <Button onClick={startFlow} variant="contained" startIcon={<GitHub />}>
            Start inloggen
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default GitHubDeviceFlow;