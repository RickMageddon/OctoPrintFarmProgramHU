import React, { useEffect, useState } from 'react';
import {
  Box, Tabs, Tab, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, Snackbar, Tooltip, CircularProgress, Pagination
} from '@mui/material';
import { Edit, Delete, Warning, Pause, Block, Replay, ArrowUpward, ArrowDownward, Save, Info } from '@mui/icons-material';
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

  // Fetch all data
  useEffect(() => {
    fetchUsers();
    fetchQueue();
    fetchPrinters();
  }, [userPage]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await axios.get('/api/users', { params: { limit: USERS_PER_PAGE, offset: (userPage - 1) * USERS_PER_PAGE, search: userSearch } });
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
    if (!window.confirm(`Pauzeer account ${user.username}?`)) return;
    await axios.post(`/api/users/${user.id}/pause`);
    fetchUsers();
    setSnackbar({ open: true, message: 'Account gepauzeerd' });
  };
  const handleBlockUser = async (user) => {
    if (!window.confirm(`Blokkeer account ${user.username}?`)) return;
    await axios.post(`/api/users/${user.id}/block`);
    fetchUsers();
    setSnackbar({ open: true, message: 'Account geblokkeerd' });
  };
  const handleWarning = async () => {
    await axios.post(`/api/users/${warningDialog.user.id}/warning`, { text: warningDialog.text });
    setWarningDialog({ open: false, user: null, text: '' });
    setSnackbar({ open: true, message: 'Waarschuwing geplaatst' });
  };

  // Queue actions
  const handleDeleteQueue = async (job) => {
    if (!window.confirm(`Verwijder job ${job.filename} van ${job.username}?`)) return;
    await axios.delete(`/api/queue/${job.id}`);
    fetchQueue();
    setSnackbar({ open: true, message: 'Printjob verwijderd' });
  };
  const handleMoveQueue = async (job, direction) => {
    await axios.post(`/api/queue/${job.id}/move`, { direction });
    fetchQueue();
  };

  // Printer actions
  const handleSetMaintenance = async (printer, maintenance) => {
    if (!window.confirm(`${maintenance ? 'Zet' : 'Haal'} ${printer.name} ${maintenance ? 'op' : 'van'} onderhoud?`)) return;
    await axios.post(`/api/printers/${printer.id}/maintenance`, { maintenance });
    fetchPrinters();
    setSnackbar({ open: true, message: maintenance ? 'Printer op onderhoud' : 'Printer weer beschikbaar' });
  };

  // View user details & logs
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

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Gebruikers" />
        <Tab label="Wachtrij" />
        <Tab label="Printers" />
      </Tabs>
      {/* Gebruikers */}
      <TabPanel value={tab} index={0}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField placeholder="Zoek gebruikers..." size="small" value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setUserPage(1); fetchUsers(); } }} />
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
                  <TableCell sx={{ color: user.blocked ? 'red' : user.paused ? 'orange' : 'green' }}>{user.blocked ? 'Geblokkeerd' : user.paused ? 'Gepauzeerd' : 'Actief'}</TableCell>
                  <TableCell>
                    <Tooltip title="Bekijk details/logs"><IconButton onClick={() => openUserDetails(user)}><Info /></IconButton></Tooltip>
                    <Tooltip title="Bewerk gebruiker"><IconButton onClick={() => handleEditUser(user)}><Edit /></IconButton></Tooltip>
                    <Tooltip title="Reset GitHub koppeling"><IconButton onClick={() => handleResetGithub(user)}><Replay /></IconButton></Tooltip>
                    <Tooltip title="Waarschuwing"><IconButton onClick={() => setWarningDialog({ open: true, user, text: '' })}><Warning /></IconButton></Tooltip>
                    <Tooltip title="Pauzeer"><IconButton onClick={() => handlePauseUser(user)}><Pause /></IconButton></Tooltip>
                    <Tooltip title="Blokkeer"><IconButton onClick={() => handleBlockUser(user)}><Block /></IconButton></Tooltip>
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
      </TabPanel>
      {/* Wachtrij */}
      <TabPanel value={tab} index={1}>
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
      <TabPanel value={tab} index={2}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Naam</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Acties</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {printers.map((printer) => (
                <TableRow key={printer.id}>
                  <TableCell>{printer.name}</TableCell>
                  <TableCell>{printer.maintenance ? 'Onderhoud' : 'Beschikbaar'}</TableCell>
                  <TableCell>
                    <Button onClick={() => handleSetMaintenance(printer, !printer.maintenance)} variant="outlined">
                      {printer.maintenance ? 'Beschikbaar maken' : 'Op onderhoud'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ open: false, message: '' })} message={snackbar.message} />
    </Box>
  );
};

export default AdminPanelPage;
