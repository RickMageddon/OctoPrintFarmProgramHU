import React, { useEffect, useState } from 'react';
import {
  Box, Tabs, Tab, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, Snackbar, Tooltip, CircularProgress, Pagination, Card, CardContent, Grid, Chip, Switch, FormControlLabel
} from '@mui/material';
import { Edit, Delete, Warning, Pause, Block, Replay, ArrowUpward, ArrowDownward, Save, Info, Assessment, People, Print, CheckCircle, Error as ErrorIcon, Cancel, PowerSettingsNew, PowerOff, FlashOn, Settings } from '@mui/icons-material';
import axios from 'axios';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

const AdminPanelPage = () => {
  const [tab, setTab] = useState(0);
  
  // Dashboard
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Users
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [editUser, setEditUser] = useState(null);
  const [warningDialog, setWarningDialog] = useState({ open: false, user: null, text: '' });
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [viewUserDetails, setViewUserDetails] = useState({ open: false, user: null, logs: [] });
  
  // Filtering & sorting
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userStudyFilter, setUserStudyFilter] = useState('all');
  const [userSort, setUserSort] = useState('created_desc');
  
  // Queue
  const [queue, setQueue] = useState([]);
  const [queueSearch, setQueueSearch] = useState('');
  const [queuePage, setQueuePage] = useState(1);
  const QUEUE_PER_PAGE = 10;
  
  // Printers
  const [printers, setPrinters] = useState([]);
  
  // Sonoff relay states
  const [relayStates, setRelayStates] = useState({});
  const [loadingRelay, setLoadingRelay] = useState({});
  const [confirmPower, setConfirmPower] = useState({ open: false, printer: null, action: null });
  
  // Sonoff configuration
  const [sonoffConfig, setSonoffConfig] = useState({ serialPort: '', baudRate: '' });
  const [availablePorts, setAvailablePorts] = useState([]);
  const [sonoffConfigDialog, setSonoffConfigDialog] = useState(false);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [loading, setLoading] = useState(false);

  // Fetch all data when tab changes
  useEffect(() => {
    if (tab === 0) fetchStats();
    if (tab === 1) fetchUsers();
    if (tab === 2) fetchQueue();
    if (tab === 3) {
      fetchPrinters();
      fetchRelayStates();
    }
  }, [tab, userPage]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await axios.get('/api/users/admin/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await axios.get('/api/users', {
        params: {
          limit: USERS_PER_PAGE,
          offset: (userPage - 1) * USERS_PER_PAGE,
          search: userSearch,
          status: userStatusFilter,
          study: userStudyFilter,
          sort: userSort
        }
      });
      setUsers(res.data.users);
      setUsersTotal(res.data.total || 0);
    } catch (err) {
      console.error('Error fetching users', err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await axios.get('/api/queue');
      const filtered = res.data.filter(j => 
        j.filename.toLowerCase().includes(queueSearch.toLowerCase()) || 
        (j.username || '').toLowerCase().includes(queueSearch.toLowerCase())
      );
      setQueue(filtered);
    } catch (err) {
      console.error('Error fetching queue', err);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await axios.get('/api/printers/status');
      setPrinters(res.data);
    } catch (err) {
      console.error('Error fetching printers', err);
    }
  };

  const fetchRelayStates = async () => {
    try {
      const res = await axios.get('/api/sonoff/states');
      setRelayStates(res.data.states || {});
    } catch (err) {
      console.error('Error fetching relay states', err);
    }
  };

  const fetchSonoffConfig = async () => {
    try {
      const res = await axios.get('/api/sonoff/config');
      setSonoffConfig(res.data.config || { serialPort: '/dev/ttyUSB0', baudRate: '115200' });
    } catch (err) {
      console.error('Error fetching Sonoff config', err);
    }
  };

  const fetchAvailablePorts = async () => {
    try {
      const res = await axios.get('/api/sonoff/serial-ports');
      setAvailablePorts(res.data.ports || []);
    } catch (err) {
      console.error('Error fetching serial ports', err);
      setAvailablePorts([]);
    }
  };

  // User actions
  const handleEditUser = (user) => setEditUser({ ...user });
  
  const handleSaveUser = async () => {
    try {
      await axios.put(`/api/users/${editUser.id}`, editUser);
      await axios.post(`/api/session-logs`, { 
        action: 'admin_edit_user', 
        details: `Edited user ${editUser.id}` 
      }).catch(()=>{});
      setEditUser(null);
      fetchUsers();
      setSnackbar({ open: true, message: 'Gebruiker opgeslagen' });
    } catch (err) {
      console.error('Save user failed', err);
      setSnackbar({ open: true, message: 'Fout bij opslaan' });
    }
  };

  const handleResetGithub = async (user) => {
    if (!window.confirm(`Reset GitHub koppeling voor ${user.username}?`)) return;
    try {
      await axios.post(`/api/users/${user.id}/reset-github`);
      fetchUsers();
      setSnackbar({ open: true, message: 'GitHub login gereset' });
    } catch (err) {
      console.error('Reset GitHub failed', err);
    }
  };

  const handlePauseUser = async (user) => {
    const action = user.paused ? 'hervatten' : 'pauzeren';
    if (!window.confirm(`Account ${user.username} ${action}?`)) return;
    try {
      await axios.post(`/api/users/${user.id}/pause`, { paused: !user.paused });
      fetchUsers();
      setSnackbar({ open: true, message: user.paused ? 'Account hervat' : 'Account gepauzeerd' });
    } catch (err) {
      console.error('Pause user failed', err);
    }
  };

  const handleBlockUser = async (user) => {
    const action = user.blocked ? 'deblokkeren' : 'blokkeren';
    if (!window.confirm(`Account ${user.username} ${action}?`)) return;
    try {
      await axios.post(`/api/users/${user.id}/block`, { blocked: !user.blocked });
      fetchUsers();
      setSnackbar({ open: true, message: user.blocked ? 'Account gedeblokkeerd' : 'Account geblokkeerd' });
    } catch (err) {
      console.error('Block user failed', err);
    }
  };

  const handleWarning = async () => {
    try {
      await axios.post(`/api/users/${warningDialog.user.id}/warning`, { text: warningDialog.text });
      setWarningDialog({ open: false, user: null, text: '' });
      setSnackbar({ open: true, message: 'Waarschuwing geplaatst' });
    } catch (err) {
      console.error('Warning failed', err);
    }
  };

  const openUserDetails = async (user) => {
    setViewUserDetails({ open: true, user, logs: [], loading: true });
    try {
      const res = await axios.get(`/api/users/${user.id}/logs`);
      setViewUserDetails({ open: true, user, logs: res.data, loading: false });
    } catch (err) {
      console.error('Failed to load logs', err);
      setViewUserDetails({ open: true, user, logs: [], loading: false });
    }
  };

  const closeUserDetails = () => setViewUserDetails({ open: false, user: null, logs: [] });

  // Queue actions
  const handleDeleteQueue = async (job) => {
    if (!window.confirm(`Verwijder job ${job.filename} van ${job.username}?`)) return;
    try {
      await axios.delete(`/api/queue/${job.id}`);
      fetchQueue();
      setSnackbar({ open: true, message: 'Printjob verwijderd' });
    } catch (err) {
      console.error('Delete queue failed', err);
    }
  };

  const handleMoveQueue = async (job, direction) => {
    try {
      await axios.post(`/api/queue/${job.id}/move`, { direction });
      fetchQueue();
    } catch (err) {
      console.error('Move queue failed', err);
    }
  };

  // Printer actions
  const handleSetMaintenance = async (printer, maintenance) => {
    if (!window.confirm(`${maintenance ? 'Zet' : 'Haal'} ${printer.name} ${maintenance ? 'op' : 'van'} onderhoud?`)) return;
    try {
      await axios.post(`/api/printers/${printer.id}/maintenance`, { maintenance });
      
      // Update local state immediately for instant feedback
      setPrinters(prevPrinters => 
        prevPrinters.map(p => 
          p.id === printer.id ? { ...p, maintenance } : p
        )
      );
      
      setSnackbar({ open: true, message: maintenance ? 'Printer op onderhoud' : 'Printer weer beschikbaar' });
      
      // Refresh from server to ensure consistency
      fetchPrinters();
    } catch (err) {
      console.error('Maintenance failed', err);
      setSnackbar({ open: true, message: 'Fout bij updaten onderhoudsstatus' });
      // Refresh on error to revert optimistic update
      fetchPrinters();
    }
  };

  // Sonoff power controls
  const handlePower = async (printer, action) => {
    setLoadingRelay(r => ({ ...r, [printer.id]: true }));
    try {
      await axios.post(`/api/sonoff/printer/${printer.id}/${action}`);
      setSnackbar({ open: true, message: `Printer ${printer.name} ${action === 'on' ? 'AAN' : 'UIT'}` });
      await fetchRelayStates();
    } catch (err) {
      setSnackbar({ open: true, message: `Fout bij power ${action}` });
    } finally {
      setLoadingRelay(r => ({ ...r, [printer.id]: false }));
    }
  };

  const handleAllPower = async (action) => {
    setLoading(true);
    try {
      await axios.post(`/api/sonoff/all/${action}`);
      setSnackbar({ open: true, message: `Alle printers ${action === 'on' ? 'AAN' : 'UIT'}` });
      await fetchRelayStates();
    } catch (err) {
      setSnackbar({ open: true, message: `Fout bij alles ${action}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSonoffConfig = async () => {
    try {
      await axios.post('/api/sonoff/config', sonoffConfig);
      setSnackbar({ open: true, message: 'Sonoff configuratie opgeslagen' });
      setSonoffConfigDialog(false);
    } catch (err) {
      console.error('Error saving Sonoff config', err);
      setSnackbar({ open: true, message: 'Fout bij opslaan configuratie' });
    }
  };

  const handleOpenSonoffConfig = async () => {
    await fetchSonoffConfig();
    await fetchAvailablePorts();
    setSonoffConfigDialog(true);
  };

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Dashboard" icon={<Assessment />} iconPosition="start" />
        <Tab label="Gebruikers" icon={<People />} iconPosition="start" />
        <Tab label="Wachtrij" icon={<Print />} iconPosition="start" />
        <Tab label="Printers" />
      </Tabs>
      
      <TabPanel value={tab} index={0}>
        {loadingStats ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : stats ? (
          <Grid container spacing={3}>
            {/* User Stats Cards */}
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Totaal Gebruikers</Typography>
                  <Typography variant="h3">{stats.users.total_users}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats.users.admin_users} admins • {stats.users.verified_users} geverifieerd
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Actieve Gebruikers</Typography>
                  <Typography variant="h3">{stats.users.active_users_7d}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Laatste 7 dagen • {stats.users.active_users_30d} laatste 30d
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Print Jobs</Typography>
                  <Typography variant="h3">{stats.jobs.total_jobs}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                    <Chip icon={<CheckCircle />} label={`${stats.jobs.completed_jobs} voltooid`} color="success" size="small" />
                    <Chip icon={<ErrorIcon />} label={`${stats.jobs.failed_jobs} mislukt`} color="error" size="small" />
                    <Chip icon={<Cancel />} label={`${stats.jobs.cancelled_jobs} geannuleerd`} size="small" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>Huidige Wachtrij</Typography>
                  <Typography variant="h3">{stats.jobs.queued_jobs + stats.jobs.printing_jobs}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {stats.jobs.printing_jobs} aan het printen • {stats.jobs.queued_jobs} in wachtrij
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {/* Recent Activity */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Recente Activiteit</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Gebruiker</TableCell>
                          <TableCell>Actie</TableCell>
                          <TableCell>Details</TableCell>
                          <TableCell>Tijd</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.recentActivity.map((log, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{log.username}</TableCell>
                            <TableCell>{log.action}</TableCell>
                            <TableCell>{log.details}</TableCell>
                            <TableCell>{new Date(log.timestamp).toLocaleString('nl-NL')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Typography>Geen data beschikbaar</Typography>
        )}
      </TabPanel>
      
      <TabPanel value={tab} index={1}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField placeholder="Zoek gebruikers..." size="small" value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setUserPage(1); fetchUsers(); } }} />
          <Select size="small" value={userStatusFilter} onChange={e => { setUserStatusFilter(e.target.value); setUserPage(1); }} displayEmpty>
            <MenuItem value="all">Alle statussen</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="blocked">Geblokkeerd</MenuItem>
            <MenuItem value="paused">Gepauzeerd</MenuItem>
            <MenuItem value="active">Actief</MenuItem>
            <MenuItem value="github_linked">GitHub gekoppeld</MenuItem>
            <MenuItem value="not_linked">Niet gekoppeld</MenuItem>
          </Select>
          <Select size="small" value={userStudyFilter} onChange={e => { setUserStudyFilter(e.target.value); setUserPage(1); }} displayEmpty>
            <MenuItem value="all">Alle richtingen</MenuItem>
            <MenuItem value="TI">TI</MenuItem>
            <MenuItem value="CSC">CSC</MenuItem>
            <MenuItem value="SD">SD</MenuItem>
            <MenuItem value="OPENICT">OPENICT</MenuItem>
            <MenuItem value="AI">AI</MenuItem>
          </Select>
          <Select size="small" value={userSort} onChange={e => { setUserSort(e.target.value); setUserPage(1); }} displayEmpty>
            <MenuItem value="created_desc">Aanmaakdatum (nieuw-oud)</MenuItem>
            <MenuItem value="created_asc">Aanmaakdatum (oud-nieuw)</MenuItem>
            <MenuItem value="name_asc">Naam (A-Z)</MenuItem>
            <MenuItem value="name_desc">Naam (Z-A)</MenuItem>
            <MenuItem value="email_asc">Email (A-Z)</MenuItem>
            <MenuItem value="email_desc">Email (Z-A)</MenuItem>
            <MenuItem value="lastlogin_desc">Laatste login (nieuw-oud)</MenuItem>
            <MenuItem value="lastlogin_asc">Laatste login (oud-nieuw)</MenuItem>
            <MenuItem value="prints_desc">Aantal prints (hoog-laag)</MenuItem>
            <MenuItem value="prints_asc">Aantal prints (laag-hoog)</MenuItem>
          </Select>
          <Button onClick={() => { setUserPage(1); fetchUsers(); }}>Zoek</Button>
          <Box sx={{ flex: 1 }} />
          {loadingUsers ? <CircularProgress size={24} /> : null}
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Gebruikersnaam</TableCell>
                <TableCell>Admin</TableCell>
                <TableCell>GitHub</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Acties</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.is_admin ? 'Ja' : 'Nee'}</TableCell>
                  <TableCell>{user.github_username || '-'}</TableCell>
                  <TableCell sx={{ color: user.blocked ? 'red' : user.paused ? 'orange' : 'green' }}>
                    {user.blocked ? 'Geblokkeerd' : user.paused ? 'Gepauzeerd' : 'Actief'}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Bekijk details/logs"><IconButton onClick={() => openUserDetails(user)}><Info /></IconButton></Tooltip>
                    <Tooltip title="Bewerk gebruiker"><IconButton onClick={() => handleEditUser(user)}><Edit /></IconButton></Tooltip>
                    <Tooltip title="Reset GitHub koppeling"><IconButton onClick={() => handleResetGithub(user)}><Replay /></IconButton></Tooltip>
                    <Tooltip title="Waarschuwing"><IconButton onClick={() => setWarningDialog({ open: true, user, text: '' })}><Warning /></IconButton></Tooltip>
                    <Tooltip title={user.paused ? "Hervatten" : "Pauzeren"}><IconButton onClick={() => handlePauseUser(user)} color={user.paused ? "warning" : "default"}><Pause /></IconButton></Tooltip>
                    <Tooltip title={user.blocked ? "Deblokkeren" : "Blokkeren"}><IconButton onClick={() => handleBlockUser(user)} color={user.blocked ? "error" : "default"}><Block /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={Math.ceil((usersTotal || 0) / USERS_PER_PAGE) || 1} page={userPage} onChange={(_, v) => { setUserPage(v); }} />
        </Box>
        {/* Edit user dialog */}
        <Dialog open={!!editUser} onClose={() => setEditUser(null)}>
          <DialogTitle>Gebruiker aanpassen</DialogTitle>
          <DialogContent>
            <TextField label="Email" value={editUser?.email || ''} fullWidth margin="dense" disabled />
            <TextField label="Gebruikersnaam" value={editUser?.username || ''} fullWidth margin="dense" onChange={e => setEditUser({ ...editUser, username: e.target.value })} />
            <Select label="Admin" value={editUser?.is_admin ? 1 : 0} fullWidth margin="dense" onChange={e => setEditUser({ ...editUser, is_admin: e.target.value })}>
              <MenuItem value={1}>Ja</MenuItem>
              <MenuItem value={0}>Nee</MenuItem>
            </Select>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditUser(null)}>Annuleren</Button>
            <Button onClick={handleSaveUser} startIcon={<Save />}>Opslaan</Button>
          </DialogActions>
        </Dialog>
        {/* Warning dialog */}
        <Dialog open={warningDialog.open} onClose={() => setWarningDialog({ open: false, user: null, text: '' })}>
          <DialogTitle>Waarschuwing plaatsen</DialogTitle>
          <DialogContent>
            <TextField label="Waarschuwing" value={warningDialog.text} onChange={e => setWarningDialog({ ...warningDialog, text: e.target.value })} fullWidth multiline minRows={3} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setWarningDialog({ open: false, user: null, text: '' })}>Annuleren</Button>
            <Button onClick={handleWarning} startIcon={<Warning />}>Plaatsen</Button>
          </DialogActions>
        </Dialog>
        {/* User details dialog */}
        <Dialog open={viewUserDetails.open} onClose={closeUserDetails} maxWidth="md" fullWidth>
          <DialogTitle>Gebruiker Details: {viewUserDetails.user?.username}</DialogTitle>
          <DialogContent>
            {viewUserDetails.loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
            ) : (
              <>
                <Typography variant="subtitle2" gutterBottom>Account Info</Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2">Email: {viewUserDetails.user?.email}</Typography>
                  <Typography variant="body2">GitHub: {viewUserDetails.user?.github_username || 'Niet gekoppeld'}</Typography>
                  <Typography variant="body2">Admin: {viewUserDetails.user?.is_admin ? 'Ja' : 'Nee'}</Typography>
                  <Typography variant="body2">Status: {viewUserDetails.user?.blocked ? 'Geblokkeerd' : viewUserDetails.user?.paused ? 'Gepauzeerd' : 'Actief'}</Typography>
                  {viewUserDetails.user?.warning && (
                    <Typography variant="body2" color="error">Waarschuwing: {viewUserDetails.user.warning}</Typography>
                  )}
                </Box>
                <Typography variant="subtitle2" gutterBottom>Recente Activiteit</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Actie</TableCell>
                        <TableCell>Details</TableCell>
                        <TableCell>Tijd</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewUserDetails.logs.length === 0 ? (
                        <TableRow><TableCell colSpan={3} align="center">Geen logs gevonden</TableCell></TableRow>
                      ) : (
                        viewUserDetails.logs.map((log, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{log.action}</TableCell>
                            <TableCell>{log.details}</TableCell>
                            <TableCell>{new Date(log.timestamp).toLocaleString('nl-NL')}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeUserDetails}>Sluiten</Button>
          </DialogActions>
        </Dialog>
      </TabPanel>
      
      <TabPanel value={tab} index={2}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField 
            placeholder="Zoek in wachtrij..." 
            size="small" 
            value={queueSearch} 
            onChange={e => setQueueSearch(e.target.value)} 
            onKeyDown={e => { if (e.key === 'Enter') fetchQueue(); }} 
          />
          <Button onClick={() => { setQueuePage(1); fetchQueue(); }}>Zoek</Button>
          <Box sx={{ flex: 1 }} />
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bestand</TableCell>
                <TableCell>Gebruiker</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Acties</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queue.slice((queuePage - 1) * QUEUE_PER_PAGE, queuePage * QUEUE_PER_PAGE).map((job, idx) => (
                <TableRow key={job.id}>
                  <TableCell>{job.filename}</TableCell>
                  <TableCell>{job.username}</TableCell>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>
                    <Tooltip title="Verwijder job"><IconButton onClick={() => handleDeleteQueue(job)}><Delete /></IconButton></Tooltip>
                    <Tooltip title="Naar boven"><IconButton onClick={() => handleMoveQueue(job, 'up')} disabled={idx === 0}><ArrowUpward /></IconButton></Tooltip>
                    <Tooltip title="Naar beneden"><IconButton onClick={() => handleMoveQueue(job, 'down')} disabled={idx === queue.length - 1}><ArrowDownward /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={Math.ceil((queue.length || 0) / QUEUE_PER_PAGE) || 1} page={queuePage} onChange={(_, v) => setQueuePage(v)} />
        </Box>
      </TabPanel>
      
      <TabPanel value={tab} index={3}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<FlashOn />} 
            onClick={() => handleAllPower('on')} 
            disabled={loading}
          >
            All ON
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            startIcon={<PowerOff />} 
            onClick={() => handleAllPower('off')} 
            disabled={loading}
          >
            All OFF
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button 
            variant="outlined" 
            startIcon={<Settings />} 
            onClick={handleOpenSonoffConfig}
          >
            Sonoff Configuratie
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Naam</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Power</TableCell>
                <TableCell>Onderhoud</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {printers.map((printer) => (
                <TableRow key={printer.id}>
                  <TableCell>{printer.name}</TableCell>
                  <TableCell>{printer.maintenance ? 'Maintenance' : (printer.state?.text || 'Unknown')}</TableCell>
                  <TableCell>
                    {relayStates[printer.id] === true ? (
                      <Chip label="AAN" color="success" icon={<PowerSettingsNew />} />
                    ) : relayStates[printer.id] === false ? (
                      <Chip label="UIT" color="error" icon={<PowerOff />} />
                    ) : (
                      <Chip label="?" color="default" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={relayStates[printer.id] || false}
                            onChange={() => setConfirmPower({ open: true, printer, action: relayStates[printer.id] ? 'off' : 'on' })}
                            disabled={loadingRelay[printer.id]}
                            color="success"
                          />
                        }
                        label={relayStates[printer.id] ? 'Power AAN' : 'Power UIT'}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={printer.maintenance || false}
                            onChange={() => handleSetMaintenance(printer, !printer.maintenance)}
                            color="warning"
                          />
                        }
                        label={printer.maintenance ? 'Onderhoud' : 'Beschikbaar'}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {/* Confirm power dialog */}
        <Dialog open={confirmPower.open} onClose={() => setConfirmPower({ open: false, printer: null, action: null })}>
          <DialogTitle>Bevestig power actie</DialogTitle>
          <DialogContent>
            <Typography>
              Weet je zeker dat je printer <b>{confirmPower.printer?.name}</b> wilt {confirmPower.action === 'on' ? 'AAN' : 'UIT'} zetten?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmPower({ open: false, printer: null, action: null })}>Annuleren</Button>
            <Button
              onClick={async () => {
                setConfirmPower({ open: false, printer: null, action: null });
                if (confirmPower.printer && confirmPower.action) {
                  await handlePower(confirmPower.printer, confirmPower.action);
                }
              }}
              color={confirmPower.action === 'on' ? 'success' : 'error'}
              variant="contained"
              autoFocus
              disabled={loadingRelay[confirmPower.printer?.id]}
            >
              {confirmPower.action === 'on' ? 'AAN' : 'UIT'}
            </Button>
          </DialogActions>
        </Dialog>
      </TabPanel>
      
      {/* Sonoff Configuration Dialog */}
      <Dialog open={sonoffConfigDialog} onClose={() => setSonoffConfigDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Sonoff Configuratie</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Seriële Poort"
              value={sonoffConfig.serialPort}
              onChange={(e) => setSonoffConfig({ ...sonoffConfig, serialPort: e.target.value })}
              fullWidth
              helperText="Selecteer de USB/Serial poort voor FT232 adapter"
            >
              {availablePorts.length === 0 ? (
                <MenuItem value="">Geen poorten gevonden</MenuItem>
              ) : (
                availablePorts.map((port) => (
                  <MenuItem key={port} value={port}>
                    {port}
                  </MenuItem>
                ))
              )}
              <MenuItem value="/dev/ttyUSB0">/dev/ttyUSB0 (standaard)</MenuItem>
              <MenuItem value="/dev/ttyUSB1">/dev/ttyUSB1</MenuItem>
              <MenuItem value="/dev/ttyACM0">/dev/ttyACM0</MenuItem>
            </TextField>

            <TextField
              select
              label="Baud Rate"
              value={sonoffConfig.baudRate}
              onChange={(e) => setSonoffConfig({ ...sonoffConfig, baudRate: e.target.value })}
              fullWidth
              helperText="Tasmota standaard: 115200"
            >
              <MenuItem value="9600">9600</MenuItem>
              <MenuItem value="19200">19200</MenuItem>
              <MenuItem value="38400">38400</MenuItem>
              <MenuItem value="57600">57600</MenuItem>
              <MenuItem value="115200">115200 (Tasmota)</MenuItem>
            </TextField>

            <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" color="info.dark">
                <strong>ℹ️ Info:</strong> Verbind de FT232 adapter met de Sonoff en controleer of de USB poort zichtbaar is in de Docker container.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSonoffConfigDialog(false)}>Annuleren</Button>
          <Button onClick={handleSaveSonoffConfig} variant="contained" color="primary">
            Opslaan
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3000} 
        onClose={() => setSnackbar({ open: false, message: '' })} 
        message={snackbar.message} 
      />
    </Box>
  );
};

export default AdminPanelPage;
