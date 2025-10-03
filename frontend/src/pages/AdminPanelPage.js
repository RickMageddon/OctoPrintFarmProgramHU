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
