import React from 'react';
import { motion } from 'framer-motion';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  GitHub,
  Print,
  CloudQueue,
  Security,
  Speed,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const { login } = useAuth();

  const features = [
    {
      icon: <Print />,
      title: '3 Prusa Printers',
      description: 'Beheer alle 3 Prusa printers vanuit één interface',
    },
    {
      icon: <CloudQueue />,
      title: 'Print Queue',
      description: 'Intelligente wachtrij met prioriteiten en real-time status',
    },
    {
      icon: <Security />,
      title: 'HU Authenticatie',
      description: 'Veilige inlog met GitHub OAuth en HU email verificatie',
    },
    {
      icon: <Speed />,
      title: 'Real-time Updates',
      description: 'Live status updates van alle printers en print jobs',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box textAlign="center" mb={6}>
          <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
            HU OctoPrint Farm
          </Typography>
          <Typography variant="h5" color="text.secondary" mb={4}>
            Professioneel 3D print management voor Hogeschool Utrecht
          </Typography>
        </Box>

        <Grid container spacing={4} mb={6}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card sx={{ height: '100%', textAlign: 'center' }}>
                  <CardContent>
                    <Box color="primary.main" mb={2}>
                      {React.cloneElement(feature.icon, { fontSize: 'large' })}
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        <Box display="flex" justifyContent="center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Paper
              elevation={8}
              sx={{
                p: 6,
                maxWidth: 400,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
              }}
            >
              <Typography variant="h4" gutterBottom>
                Welkom
              </Typography>
              <Typography variant="body1" mb={4}>
                Log in met je GitHub account om toegang te krijgen tot de HU OctoPrint Farm
              </Typography>
              
              <Button
                variant="contained"
                size="large"
                startIcon={<GitHub />}
                onClick={login}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  py: 1.5,
                  px: 4,
                }}
                fullWidth
              >
                Inloggen met GitHub
              </Button>
              
              <Box mt={3}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Je hebt een @hu.nl of @student.hu.nl email adres nodig
                </Typography>
              </Box>
            </Paper>
          </motion.div>
        </Box>

        <Box mt={8} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Deze applicatie is ontwikkeld voor Hogeschool Utrecht
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Voor support, neem contact op met de ICT afdeling
          </Typography>
        </Box>
      </motion.div>
    </Container>
  );
};

export default LoginPage;
