import React, { useEffect, useState } from 'react';
import {
  Box, Tabs, Tab, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, Snackbar, Tooltip, CircularProgress, Pagination, Card, CardContent, Grid, Chip
} from '@mui/material';
import { Edit, Delete, Warning, Pause, Block, Replay, ArrowUpward, ArrowDownward, Save, Info, Assessment, People, Print, CheckCircle, Error as ErrorIcon, Cancel, PowerSettingsNew, PowerOff, FlashOn } from '@mui/icons-material';
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
      fetchPrinters();
      setSnackbar({ open: true, message: maintenance ? 'Printer op onderhoud' : 'Printer weer beschikbaar' });
    } catch (err) {
      console.error('Maintenance failed', err);
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

  return (
    <Box sx={{ width: '100%', mt: 2 }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Dashboard" icon={<Assessment />} iconPosition="start" />
        <Tab label="Gebruikers" icon={<People />} iconPosition="start" />
        <Tab label="Wachtrij" icon={<Print />} iconPosition="start" />
        <Tab label="Printers" />
      </Tabs>
      
      <TabPanel value={tab} index={0}>
        <Typography>Dashboard komt hier</Typography>
      </TabPanel>
      
      <TabPanel value={tab} index={1}>
        <Typography>Gebruikers komt hier</Typography>
      </TabPanel>
      
      <TabPanel value={tab} index={2}>
        <Typography>Wachtrij komt hier</Typography>
      </TabPanel>
      
      <TabPanel value={tab} index={3}>
        <Typography>Printers komt hier</Typography>
      </TabPanel>
      
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
