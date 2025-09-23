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

    Step,  Stepper,

const EmailVerificationPage = () => {

  const { verifyEmail, verifyCode } = useAuth();    StepLabel,  Step,

  const navigate = useNavigate();

  const [step, setStep] = useState(0);    Divider  StepLabel,

  const [email, setEmail] = useState('');

  const [code, setCode] = useState('');} from '@mui/material';  CircularProgress,

  const [token, setToken] = useState('');

  const [loading, setLoading] = useState(false);import { GitHub as GitHubIcon } from '@mui/icons-material';} from '@mui/material';

  const [error, setError] = useState('');

import { useNavigate } from 'react-router-dom';import { Email, CheckCircle } from '@mui/icons-material';

  const steps = ['HU Email Invoeren', 'Verificatiecode Invoeren', 'GitHub Koppelen'];

import { useAuth } from '../contexts/AuthContext';

  const handleEmailSubmit = async (e) => {

    e.preventDefault();const EmailVerificationPage = () => {import toast from 'react-hot-toast';

    

    if (!email.endsWith('@hu.nl') && !email.endsWith('@student.hu.nl')) {    const [email, setEmail] = useState('');

      setError('Alleen @hu.nl en @student.hu.nl email adressen zijn toegestaan');

      return;    const [verificationCode, setVerificationCode] = useState('');const EmailVerificationPage = () => {

    }

    const [step, setStep] = useState(0); // 0: email, 1: verification, 2: success  const { verifyEmail, verifyCode } = useAuth();

    setLoading(true);

    setError('');    const [loading, setLoading] = useState(false);  const [step, setStep] = useState(0);



    try {    const [error, setError] = useState('');  const [email, setEmail] = useState('');

      const response = await verifyEmail(email);

      setToken(response.token);    const [success, setSuccess] = useState('');  const [code, setCode] = useState('');

      setStep(1);

      toast.success('Verificatiecode verzonden naar je email!');    const [username, setUsername] = useState('');  const [token, setToken] = useState('');

    } catch (err) {

      setError(err.error || 'Fout bij versturen verificatiecode');    const navigate = useNavigate();  const [loading, setLoading] = useState(false);

    } finally {

      setLoading(false);  const [error, setError] = useState('');

    }

  };    const steps = [



  const handleCodeSubmit = async (e) => {        'E-mailadres invoeren',  const steps = ['HU Email Invoeren', 'Verificatiecode Invoeren', 'Voltooid'];

    e.preventDefault();

            'E-mail verificatie',

    if (code.length !== 6) {

      setError('Verificatiecode moet 6 cijfers zijn');        'GitHub koppelen'  const handleEmailSubmit = async (e) => {

      return;

    }    ];    e.preventDefault();



    setLoading(true);    

    setError('');

    // Check for email parameter in URL    if (!email.endsWith('@hu.nl') && !email.endsWith('@student.hu.nl')) {

    try {

      await verifyCode(token, code);    useEffect(() => {      setError('Alleen @hu.nl en @student.hu.nl email adressen zijn toegestaan');

      setStep(2);

      toast.success('Email succesvol geverifieerd!');        const urlParams = new URLSearchParams(window.location.search);      return;

    } catch (err) {

      setError(err.error || 'Ongeldige verificatiecode');        const emailParam = urlParams.get('email');    }

    } finally {

      setLoading(false);        if (emailParam) {

    }

  };            setEmail(emailParam);    setLoading(true);



  const handleGitHubLink = () => {            setStep(1); // Skip to verification step    setError('');

    // Redirect to GitHub OAuth for linking

    window.location.href = '/api/auth/github';        }

  };

    }, []);    try {

  const extractNameFromEmail = (emailAddress) => {

    const parts = emailAddress.split('@')[0].split('.');      const response = await verifyEmail(email);

    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

  };    const handleEmailSubmit = async (e) => {      setToken(response.token);



  return (        e.preventDefault();      setStep(1);

    <Container maxWidth="md" sx={{ py: 8 }}>

      <motion.div              toast.success('Verificatiecode verzonden naar je email!');

        initial={{ opacity: 0, y: 20 }}

        animate={{ opacity: 1, y: 0 }}        if (!email.endsWith('@hu.nl') && !email.endsWith('@student.hu.nl')) {    } catch (err) {

        transition={{ duration: 0.5 }}

      >            setError('Gebruik je HU e-mailadres (@hu.nl of @student.hu.nl)');      setError(err.error || 'Fout bij versturen verificatiecode');

        <Box textAlign="center" mb={4}>

          <Email color="primary" sx={{ fontSize: 64 }} />            return;    } finally {

          <Typography variant="h4" component="h1" gutterBottom>

            Account Registratie        }      setLoading(false);

          </Typography>

          <Typography variant="body1" color="text.secondary">    }

            Maak je Printmeister account aan in 3 eenvoudige stappen

          </Typography>        setLoading(true);  };

        </Box>

        setError('');

        <Paper elevation={8} sx={{ p: 6, maxWidth: 600, mx: 'auto' }}>

          <Stepper activeStep={step} sx={{ mb: 4 }}>  const handleCodeSubmit = async (e) => {

            {steps.map((label) => (

              <Step key={label}>        try {    e.preventDefault();

                <StepLabel>{label}</StepLabel>

              </Step>            const response = await fetch('/api/auth/register', {    

            ))}

          </Stepper>                method: 'POST',    if (code.length !== 6) {



          {error && (                headers: {      setError('Verificatiecode moet 6 cijfers zijn');

            <Alert severity="error" sx={{ mb: 3 }}>

              {error}                    'Content-Type': 'application/json',      return;

            </Alert>

          )}                },    }



          {/* Step 1: Email Input */}                body: JSON.stringify({ email }),

          {step === 0 && (

            <motion.div            });    setLoading(true);

              initial={{ opacity: 0, x: -20 }}

              animate={{ opacity: 1, x: 0 }}    setError('');

              transition={{ duration: 0.3 }}

            >            const data = await response.json();

              <Box component="form" onSubmit={handleEmailSubmit}>

                <Typography variant="h6" gutterBottom>    try {

                  Stap 1: HU Email Adres

                </Typography>            if (response.ok) {      await verifyCode(token, code);

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>

                  Voer je Hogeschool Utrecht email adres in om te beginnen                setUsername(data.username);      setStep(2);

                </Typography>

                setSuccess(`Verificatiecode verzonden naar ${email}`);      toast.success('Email succesvol geverifieerd!');

                <TextField

                  fullWidth                setStep(1);      

                  label="HU Email Adres"

                  type="email"            } else {      // Redirect to dashboard after success

                  value={email}

                  onChange={(e) => setEmail(e.target.value)}                setError(data.error || 'Er is een fout opgetreden');      setTimeout(() => {

                  disabled={loading}

                  placeholder="jouw.naam@hu.nl of jouw.naam@student.hu.nl"            }        window.location.href = '/dashboard';

                  sx={{ mb: 3 }}

                />        } catch (err) {      }, 2000);



                <Box display="flex" gap={2}>            console.error('Registration error:', err);    } catch (err) {

                  <Button

                    variant="outlined"            setError('Er is een fout opgetreden bij het verzenden van de verificatiecode');      setError(err.error || 'Ongeldige verificatiecode');

                    onClick={() => navigate('/login')}

                    disabled={loading}        } finally {    } finally {

                    sx={{ flex: 1 }}

                  >            setLoading(false);      setLoading(false);

                    Terug naar Login

                  </Button>        }    }

                  <Button

                    type="submit"    };  };

                    variant="contained"

                    disabled={loading || !email}

                    sx={{ flex: 1 }}

                  >    const handleVerificationSubmit = async (e) => {  const extractNameFromEmail = (emailAddress) => {

                    {loading ? <CircularProgress size={20} /> : 'Verstuur Verificatiecode'}

                  </Button>        e.preventDefault();    const parts = emailAddress.split('@')[0].split('.');

                </Box>

              </Box>            return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

            </motion.div>

          )}        if (!verificationCode || verificationCode.length !== 6) {  };



          {/* Step 2: Code Verification */}            setError('Voer de 6-cijferige verificatiecode in');

          {step === 1 && (

            <motion.div            return;  return (

              initial={{ opacity: 0, x: -20 }}

              animate={{ opacity: 1, x: 0 }}        }    <Container maxWidth="md" sx={{ py: 8 }}>

              transition={{ duration: 0.3 }}

            >      <motion.div

              <Box component="form" onSubmit={handleCodeSubmit}>

                <Typography variant="h6" gutterBottom>        setLoading(true);        initial={{ opacity: 0, y: 20 }}

                  Stap 2: Email Verificatie

                </Typography>        setError('');        animate={{ opacity: 1, y: 0 }}

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>

                  We hebben een 6-cijferige verificatiecode gestuurd naar:        transition={{ duration: 0.5 }}

                </Typography>

        try {      >

                <Chip 

                  label={email}             const response = await fetch('/api/auth/verify-registration', {        <Box textAlign="center" mb={4}>

                  color="primary" 

                  variant="outlined"                 method: 'POST',          <Email color="primary" sx={{ fontSize: 64 }} />

                  icon={<Email />}

                  sx={{ mb: 3 }}                headers: {          <Typography variant="h4" component="h1" gutterBottom>

                />

                    'Content-Type': 'application/json',            HU Email Verificatie

                <TextField

                  fullWidth                },          </Typography>

                  label="Verificatiecode"

                  value={code}                body: JSON.stringify({           <Typography variant="body1" color="text.secondary">

                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}

                  disabled={loading}                    email: email,            Verifieer je Hogeschool Utrecht email adres om toegang te krijgen

                  placeholder="123456"

                  inputProps={{                     code: verificationCode          </Typography>

                    maxLength: 6,

                    style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }                }),        </Box>

                  }}

                  sx={{ mb: 3 }}            });

                />

        <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>

                <Box display="flex" gap={2}>

                  <Button            const data = await response.json();          <Stepper activeStep={step} sx={{ mb: 4 }}>

                    variant="outlined"

                    onClick={() => setStep(0)}            {steps.map((label) => (

                    disabled={loading}

                    sx={{ flex: 1 }}            if (response.ok) {              <Step key={label}>

                  >

                    Terug                setSuccess('E-mail geverifieerd! Je account is aangemaakt.');                <StepLabel>{label}</StepLabel>

                  </Button>

                  <Button                setStep(2);              </Step>

                    type="submit"

                    variant="contained"            } else {            ))}

                    disabled={loading || code.length !== 6}

                    sx={{ flex: 1 }}                setError(data.error || 'Ongeldige verificatiecode');          </Stepper>

                  >

                    {loading ? <CircularProgress size={20} /> : 'Verifieer Code'}            }

                  </Button>

                </Box>        } catch (err) {          {error && (

              </Box>

            </motion.div>            console.error('Verification error:', err);            <Alert severity="error" sx={{ mb: 3 }}>

          )}

            setError('Er is een fout opgetreden bij het verifiëren van de code');              {error}

          {/* Step 3: GitHub Linking */}

          {step === 2 && (        } finally {            </Alert>

            <motion.div

              initial={{ opacity: 0, x: -20 }}            setLoading(false);          )}

              animate={{ opacity: 1, x: 0 }}

              transition={{ duration: 0.3 }}        }

            >

              <Box textAlign="center">    };          {step === 0 && (

                <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />

                <Typography variant="h6" color="success.main" gutterBottom>            <motion.div

                  Email Geverifieerd!

                </Typography>    const handleGitHubLogin = () => {              initial={{ opacity: 0, x: -20 }}

                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>

                  Welkom {extractNameFromEmail(email)}! Nu koppelen we je GitHub account.        // Redirect to GitHub OAuth              animate={{ opacity: 1, x: 0 }}

                </Typography>

                        window.location.href = '/api/auth/github';              transition={{ duration: 0.3 }}

                <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>

                  <Typography variant="body2">    };            >

                    <strong>Belangrijk:</strong> Zorg ervoor dat je GitHub account gekoppeld is aan 

                    hetzelfde HU email adres ({email}) en dat dit email adres geverifieerd is in GitHub.              <form onSubmit={handleEmailSubmit}>

                  </Typography>

                </Alert>    const renderEmailStep = () => (                <Typography variant="h6" gutterBottom>



                <Button        <Box component="form" onSubmit={handleEmailSubmit}>                  Voer je HU email adres in

                  variant="contained"

                  size="large"            <Typography variant="h5" gutterBottom>                </Typography>

                  startIcon={<GitHub />}

                  onClick={handleGitHubLink}                Registreren voor Printmeister                <Typography variant="body2" color="text.secondary" mb={3}>

                  sx={{ mb: 3 }}

                  fullWidth            </Typography>                  We sturen een verificatiecode naar je @hu.nl of @student.hu.nl email adres

                >

                  Koppel GitHub Account            <Typography variant="body1" sx={{ mb: 3 }}>                </Typography>

                </Button>

                Voer je HU e-mailadres in om een account aan te maken.                

                <Typography variant="caption" color="text.secondary">

                  Door te klikken ga je naar GitHub om je account te koppelen            </Typography>                <TextField

                </Typography>

              </Box>                              fullWidth

            </motion.div>

          )}            <TextField                  label="HU Email Adres"

        </Paper>

      </motion.div>                fullWidth                  type="email"

    </Container>

  );                label="HU E-mailadres"                  value={email}

};

                type="email"                  onChange={(e) => setEmail(e.target.value)}

export default EmailVerificationPage;
                value={email}                  required

                onChange={(e) => setEmail(e.target.value)}                  disabled={loading}

                placeholder="jouw.naam@student.hu.nl"                  placeholder="jouw.naam@student.hu.nl"

                required                  sx={{ mb: 3 }}

                sx={{ mb: 3 }}                />

                helperText="Gebruik je @hu.nl of @student.hu.nl e-mailadres"

            />                {email && (email.endsWith('@hu.nl') || email.endsWith('@student.hu.nl')) && (

                  <Alert severity="info" sx={{ mb: 3 }}>

            <Button                    Je naam wordt opgeslagen als: <strong>{extractNameFromEmail(email)}</strong>

                type="submit"                  </Alert>

                fullWidth                )}

                variant="contained"

                size="large"                <Button

                disabled={loading}                  type="submit"

                sx={{ mb: 2 }}                  variant="contained"

            >                  fullWidth

                {loading ? 'Verzenden...' : 'Verificatiecode versturen'}                  disabled={loading || !email}

            </Button>                  startIcon={loading ? <CircularProgress size={20} /> : <Email />}

        </Box>                >

    );                  {loading ? 'Versturen...' : 'Verificatiecode Versturen'}

                </Button>

    const renderVerificationStep = () => (              </form>

        <Box component="form" onSubmit={handleVerificationSubmit}>            </motion.div>

            <Typography variant="h5" gutterBottom>          )}

                E-mail verificatie

            </Typography>          {step === 1 && (

            <Typography variant="body1" sx={{ mb: 1 }}>            <motion.div

                We hebben een 6-cijferige verificatiecode gestuurd naar:              initial={{ opacity: 0, x: -20 }}

            </Typography>              animate={{ opacity: 1, x: 0 }}

            <Typography variant="body1" sx={{ mb: 3, fontWeight: 'bold' }}>              transition={{ duration: 0.3 }}

                {email}            >

            </Typography>              <form onSubmit={handleCodeSubmit}>

            {username && (                <Typography variant="h6" gutterBottom>

                <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>                  Voer verificatiecode in

                    Je gebruikersnaam wordt: <strong>{username}</strong>                </Typography>

                </Typography>                <Typography variant="body2" color="text.secondary" mb={3}>

            )}                  We hebben een 6-cijferige code gestuurd naar <strong>{email}</strong>

                            </Typography>

            <TextField                

                fullWidth                <TextField

                label="Verificatiecode"                  fullWidth

                value={verificationCode}                  label="Verificatiecode"

                onChange={(e) => setVerificationCode(e.target.value)}                  value={code}

                placeholder="123456"                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}

                inputProps={{ maxLength: 6 }}                  required

                required                  disabled={loading}

                sx={{ mb: 3 }}                  placeholder="123456"

                helperText="Controleer ook je spam/ongewenste e-mail map"                  inputProps={{ 

            />                    style: { 

                      textAlign: 'center',

            <Button                      fontSize: '1.5rem',

                type="submit"                      letterSpacing: '0.5rem'

                fullWidth                    }

                variant="contained"                  }}

                size="large"                  sx={{ mb: 3 }}

                disabled={loading}                />

                sx={{ mb: 2 }}

            >                <Box display="flex" gap={2}>

                {loading ? 'Verifiëren...' : 'E-mail verifiëren'}                  <Button

            </Button>                    variant="outlined"

                    onClick={() => setStep(0)}

            <Button                    disabled={loading}

                fullWidth                    fullWidth

                variant="text"                  >

                onClick={() => setStep(0)}                    Terug

                disabled={loading}                  </Button>

            >                  <Button

                Ander e-mailadres gebruiken                    type="submit"

            </Button>                    variant="contained"

        </Box>                    fullWidth

    );                    disabled={loading || code.length !== 6}

                    startIcon={loading ? <CircularProgress size={20} /> : null}

    const renderSuccessStep = () => (                  >

        <Box textAlign="center">                    {loading ? 'Verifiëren...' : 'Verifiëren'}

            <Typography variant="h5" gutterBottom>                  </Button>

                Account aangemaakt! 🎉                </Box>

            </Typography>

            <Typography variant="body1" sx={{ mb: 1 }}>                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center' }}>

                Je account is succesvol aangemaakt met gebruikersnaam:                  De code is 10 minuten geldig

            </Typography>                </Typography>

            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>              </form>

                {username}            </motion.div>

            </Typography>          )}

            

            <Divider sx={{ my: 3 }} />          {step === 2 && (

                        <motion.div

            <Typography variant="body1" sx={{ mb: 3 }}>              initial={{ opacity: 0, scale: 0.9 }}

                Koppel nu je GitHub account om in te loggen:              animate={{ opacity: 1, scale: 1 }}

            </Typography>              transition={{ duration: 0.3 }}

            >

            <Button              <Box textAlign="center">

                fullWidth                <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />

                variant="contained"                <Typography variant="h6" gutterBottom>

                size="large"                  Email Succesvol Geverifieerd!

                startIcon={<GitHubIcon />}                </Typography>

                onClick={handleGitHubLogin}                <Typography variant="body2" color="text.secondary" mb={3}>

                sx={{ mb: 2 }}                  Je wordt doorgestuurd naar het dashboard...

            >                </Typography>

                Inloggen met GitHub                <CircularProgress />

            </Button>              </Box>

            </motion.div>

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>          )}

                Zorg ervoor dat je HU e-mailadres ({email}) gekoppeld is aan je GitHub account.        </Paper>

            </Typography>      </motion.div>

        </Box>    </Container>

    );  );

};

    return (

        <Container maxWidth="sm" sx={{ mt: 4 }}>export default EmailVerificationPage;

            <Paper elevation={3} sx={{ p: 4 }}>
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

                {success && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                        {success}
                    </Alert>
                )}

                {step === 0 && renderEmailStep()}
                {step === 1 && renderVerificationStep()}
                {step === 2 && renderSuccessStep()}
            </Paper>
        </Container>
    );
};

export default EmailVerificationPage;