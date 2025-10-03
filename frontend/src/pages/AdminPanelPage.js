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
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

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
