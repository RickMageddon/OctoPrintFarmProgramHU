import React, { useEffect, useState } from 'react';
import {
  Box, Tabs, Tab, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, Snackbar, Tooltip, CircularProgress, Pagination, Card, CardContent, Grid, Checkbox, FormControl, InputLabel, Chip
} from '@mui/material';
import { Edit, Delete, Warning, Pause, Block, Replay, ArrowUpward, ArrowDownward, Save, Info, Download, Assessment, TrendingUp, People, Print, CheckCircle, Error as ErrorIcon, Cancel, PowerSettingsNew, PowerOff, FlashOn } from '@mui/icons-material';
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
  // ...andere state...
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
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });
  const [loading, setLoading] = useState(false);

  // Sonoff relay states
  const [relayStates, setRelayStates] = useState({});
  const [loadingRelay, setLoadingRelay] = useState({});
  const [confirmPower, setConfirmPower] = useState({ open: false, printer: null, action: null });

  // Fetch relay states
  const fetchRelayStates = async () => {
    try {
      const res = await axios.get('/api/sonoff/states');
      setRelayStates(res.data.states || {});
    } catch (err) {
      console.error('Error fetching relay states', err);
    }

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
    const res = await axios.get('/api/queue');
    // simple client-side search/pagination for queue
    const filtered = res.data.filter(j => j.filename.toLowerCase().includes(queueSearch.toLowerCase()) || (j.username || '').toLowerCase().includes(queueSearch.toLowerCase()));
    setQueue(filtered);
  };
  const fetchPrinters = async () => {
    const res = await axios.get('/api/printers/status');
    setPrinters(res.data);
  };

  // User actions
  const handleEditUser = (user) => setEditUser({ ...user });
  const handleSaveUser = async () => {
    try {
      await axios.put(`/api/users/${editUser.id}`, editUser);
      // log action
      await axios.post(`/api/session-logs`, { action: 'admin_edit_user', details: `Edited user ${editUser.id}` }).catch(()=>{});
    } catch (err) {
      console.error('Save user failed', err);
    }
    setEditUser(null);
    fetchUsers();
    setSnackbar({ open: true, message: 'Gebruiker opgeslagen' });
  };
  const handleResetGithub = async (user) => {
    if (!window.confirm(`Reset GitHub koppeling voor ${user.username}?`)) return;
    await axios.post(`/api/users/${user.id}/reset-github`);
    fetchUsers();
    setSnackbar({ open: true, message: 'GitHub login gereset' });
  };
  const handlePauseUser = async (user) => {
    const action = user.paused ? 'hervatten' : 'pauzeren';
  <Box sx={{ width: '100%', mt: 2 }}>
    <Tabs value={tab} onChange={(_, v) => setTab(v)}>
      <Tab label="Dashboard" icon={<Assessment />} iconPosition="start" />
      <Tab label="Gebruikers" icon={<People />} iconPosition="start" />
      <Tab label="Wachtrij" icon={<Print />} iconPosition="start" />
      <Tab label="Printers" />
    </Tabs>
    {/* Dashboard */}
    <TabPanel value={tab} index={0}>
      {loadingStats ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : stats ? (
        <Grid container spacing={3}>
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
    {/* Gebruikers */}
    <TabPanel value={tab} index={1}>
      {/* ...gebruikers tab code, ongewijzigd... */}
    </TabPanel>
    {/* Wachtrij */}
    <TabPanel value={tab} index={2}>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField placeholder="Zoek in wachtrij..." size="small" value={queueSearch} onChange={e => setQueueSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') fetchQueue(); }} />
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
    {/* Printers */}
    <TabPanel value={tab} index={3}>
      {/* ...printers tab code, ongewijzigd... */}
    </TabPanel>
    <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
  </Box>
);

export default AdminPanelPage;
                  <TableCell>
                    <Button
                      variant={relayStates[printer.id] ? 'outlined' : 'contained'}
                      color={relayStates[printer.id] ? 'error' : 'success'}
                      startIcon={relayStates[printer.id] ? <PowerOff /> : <PowerSettingsNew />}
                      disabled={loadingRelay[printer.id]}
                      onClick={() => setConfirmPower({ open: true, printer, action: relayStates[printer.id] ? 'off' : 'on' })}
                    >
                      {relayStates[printer.id] ? 'Uitschakelen' : 'Aanzetten'}
                    </Button>
                    <Button onClick={() => handleSetMaintenance(printer, !printer.maintenance)} variant="outlined" sx={{ ml: 1 }}>
                      {printer.maintenance ? 'Beschikbaar maken' : 'Op onderhoud'}
                    </Button>
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
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />

    </Box>
  );
}
export default AdminPanelPage;
