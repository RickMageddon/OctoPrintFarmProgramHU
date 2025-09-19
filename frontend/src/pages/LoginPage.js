

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box textAlign="center" mb={6}>
          <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
            Printmeister
          </Typography>
          <Typography variant="h5" color="text.secondary" mb={4}>
            Professioneel 3D print management voor Hogeschool Utrecht
          </Typography>
        </Box>

        <Grid container spacing={4} mb={6}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.1 }}>
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
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.5 }}>
            <Box sx={{ maxWidth: 500, width: '100%' }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Paper elevation={8} sx={{ p: 6, textAlign: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <Typography variant="h4" gutterBottom>Welkom terug</Typography>
                <Typography variant="body1" mb={4}>Log in met je GitHub account om toegang te krijgen tot Printmeister</Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<GitHub />}
                  onClick={handleGitHubLogin}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
                    py: 1.5,
                    px: 4,
                  }}
                  fullWidth
                >
                  Inloggen met GitHub
                </Button>
                <Box mt={3}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Je GitHub account moet gekoppeld zijn aan een @hu.nl of @student.hu.nl email
                  </Typography>
                </Box>
                <Divider sx={{ my: 3, backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />
                <Box mt={3}>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
                    Nog geen account?
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Email />}
                    onClick={handleRegister}
                    sx={{
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                    fullWidth
                  >
                    Registreer met Email
                  </Button>
                </Box>
              </Paper>
            </Box>
          </motion.div>
        </Box>

        <Box mt={8} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Deze applicatie is ontwikkeld door{' '}
            <Typography
              component="a"
              href="https://rickmageddon.com/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
            >
              Rick van der Voort
            </Typography>{' '}voor Hogeschool Utrecht
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Voor support, neem contact op met <strong>Turing Lab</strong>
          </Typography>
        </Box>
      </motion.div>
    </Container>
  );
};

export default LoginPage;