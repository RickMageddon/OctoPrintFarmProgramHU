import React, { useState, useEffect, useRef } from 'react';
import {
    Container,
    Typography,
    Card,
    CardContent,
    Grid,
    Box,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    ListItemSecondaryAction,
    Chip,
    Alert,
    LinearProgress,
    Paper,
    Snackbar,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Checkbox,
    FormControlLabel
} from '@mui/material';
import {
    CloudUpload,
    InsertDriveFile,
    Delete,
    Print,
    Download,
    Favorite,
    FavoriteBorder,
    Visibility,
    FileUpload,
    Code,
    Warning,
    Star,
    Close
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const FilesPage = () => {
    const { user } = useAuth();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploadDialog, setUploadDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, fileId: null, fileName: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [printerStatus, setPrinterStatus] = useState([]);
    
    // Print dialog state
    const [printDialog, setPrintDialog] = useState({ open: false, file: null });
    const [printer, setPrinter] = useState('auto');
    const [priority, setPriority] = useState('normal');
    const [filamentChange, setFilamentChange] = useState(false);
    const [notes, setNotes] = useState('');
    const [printError, setPrintError] = useState('');
    
    const fileInputRef = useRef();

    // Fetch user's uploaded files
    const fetchFiles = async () => {
        try {
            setLoading(true);
            console.log('[FILES] Fetching files from /api/files/user...');
            const response = await axios.get('/api/files/user');
            console.log('[FILES] Response received:', response.data);
            console.log('[FILES] Files array:', response.data.files);
            
            const filesArray = response.data.files || [];
            console.log('[FILES] Processing', filesArray.length, 'files');
            
            // Log each file's favorite status
            filesArray.forEach(file => {
                console.log(`[FILES] File ${file.id}: ${file.original_filename || file.filename}, is_favorite: ${file.is_favorite}`);
            });
            
            setFiles(filesArray);
        } catch (error) {
            console.error('Error fetching files:', error);
            console.error('Error response:', error.response?.data);
            setError('Kon bestanden niet laden');
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
        fetchPrinterStatus();
    }, []);

    // Fetch printer status for the print dialog
    const fetchPrinterStatus = async () => {
        try {
            const response = await axios.get('/api/printers/status');
            setPrinterStatus(response.data);
        } catch (error) {
            console.error('Error fetching printer status:', error);
            setPrinterStatus([]);
        }
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.name.toLowerCase().endsWith('.bgcode') || 
                file.name.toLowerCase().endsWith('.gcode') || 
                file.name.toLowerCase().endsWith('.g')) {
                setSelectedFile(file);
                setError('');
            } else {
                setError('Alleen BGCODE/G-code bestanden (.bgcode, .gcode, .g) zijn toegestaan');
                setSelectedFile(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', selectedFile);

            await axios.post('/api/files/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setUploadDialog(false);
            setSelectedFile(null);
            fetchFiles(); // Refresh file list
        } catch (error) {
            console.error('Upload error:', error);
            setError(error.response?.data?.error || 'Upload mislukt');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (fileId) => {
        try {
            await axios.delete(`/api/files/${fileId}`);
            setDeleteDialog({ open: false, fileId: null, fileName: '' });
            fetchFiles(); // Refresh file list
        } catch (error) {
            console.error('Delete error:', error);
            setError('Kon bestand niet verwijderen');
        }
    };

    const openDeleteDialog = (fileId, fileName) => {
        setDeleteDialog({ open: true, fileId, fileName });
    };

    const handleFavorite = async (fileId, isFavorite) => {
        try {
            console.log(`[FAVORITE] Changing favorite status for file ${fileId}: ${isFavorite} -> ${!isFavorite}`);
            
            if (isFavorite) {
                console.log(`[FAVORITE] Removing favorite status for file ${fileId}`);
                const response = await axios.delete(`/api/files/${fileId}/favorite`);
                console.log(`[FAVORITE] Delete response:`, response.data);
            } else {
                console.log(`[FAVORITE] Adding favorite status for file ${fileId}`);
                const response = await axios.post(`/api/files/${fileId}/favorite`);
                console.log(`[FAVORITE] Post response:`, response.data);
            }
            
            console.log(`[FAVORITE] Success! Refreshing file list...`);
            
            // Update the local state immediately for better UX
            setFiles(prevFiles => prevFiles.map(file => 
                file.id === fileId 
                    ? { ...file, is_favorite: !isFavorite }
                    : file
            ).sort((a, b) => {
                // Sort favorites first
                if (a.is_favorite && !b.is_favorite) return -1;
                if (!a.is_favorite && b.is_favorite) return 1;
                return 0;
            }));
            
            // Also fetch fresh data from server
            await fetchFiles();
        } catch (error) {
            console.error('Favorite error:', error);
            console.error('Favorite error response:', error.response?.data);
            setError(`Kon favoriet status niet wijzigen: ${error.response?.data?.error || error.message}`);
            
            // Revert local state on error
            fetchFiles();
        }
    };

    const handlePrint = (file) => {
        console.log(`[PRINT] Opening print dialog for file:`, file);
        setPrintDialog({ open: true, file });
        setPrinter('auto');
        setPriority('normal');
        setFilamentChange(false);
        setNotes('');
        setPrintError('');
    };

    const handlePrintSubmit = async () => {
        try {
            setPrintError('');
            console.log(`[PRINT] Submitting print job for file ${printDialog.file.id}...`);
            
            const payload = {
                fileId: printDialog.file.id,
                printer: printer,
                priority: priority,
                filamentChange: filamentChange,
                notes: notes
            };
            console.log(`[PRINT] Sending payload:`, payload);
            
            const response = await axios.post('/api/queue/add', payload);
            console.log(`[PRINT] Success response:`, response.data);
            
            setSuccessMessage(`Bestand "${printDialog.file.original_filename || printDialog.file.filename}" succesvol toegevoegd aan print wachtrij!`);
            setPrintDialog({ open: false, file: null });
            
            // Reset form
            setPrinter('auto');
            setPriority('normal');
            setFilamentChange(false);
            setNotes('');
        } catch (error) {
            console.error('Print error:', error);
            console.error('Print error response:', error.response?.data);
            setPrintError(`Kon bestand niet toevoegen aan wachtrij: ${error.response?.data?.error || error.message}`);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('nl-NL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Typography>Bestanden laden...</Typography>
                <LinearProgress sx={{ mt: 2 }} />
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Box display="flex" alignItems="center" mb={4}>
                    <InsertDriveFile sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            Mijn Bestanden
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Beheer je geüploade G-code bestanden
                        </Typography>
                    </Box>
                    <Box ml="auto">
                        <Button
                            variant="contained"
                            startIcon={<CloudUpload />}
                            onClick={() => setUploadDialog(true)}
                        >
                            Bestand Uploaden
                        </Button>
                    </Box>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {/* Favorieten Sectie */}
                <Typography variant="h5" gutterBottom sx={{ mt: 2, mb: 2, display: 'flex', alignItems: 'center' }}>
                    <Favorite sx={{ mr: 1, color: 'secondary.main' }} />
                    Mijn Favorieten
                </Typography>
                
                {files.filter(file => file.is_favorite).length === 0 ? (
                    <Card sx={{ mb: 4 }}>
                        <CardContent sx={{ textAlign: 'center', py: 4 }}>
                            <FavoriteBorder sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                Nog geen favoriete bestanden
                            </Typography>
                            <Typography color="text.secondary">
                                Klik op het hartje bij een bestand om het als favoriet toe te voegen
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <Grid container spacing={2} sx={{ mb: 4 }}>
                        {files.filter(file => file.is_favorite).map((file, index) => (
                            <Grid item xs={12} key={`fav-${file.id}`}>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.1 }}
                                >
                                    <Card sx={{ backgroundColor: 'rgba(25, 118, 210, 0.08)' }}>
                                        <CardContent>
                                            <Box display="flex" alignItems="center">
                                                <Code sx={{ fontSize: 40, mr: 2, color: 'secondary.main' }} />
                                                <Box flex={1}>
                                                    <Typography variant="h6" gutterBottom>
                                                        {file.original_filename || file.filename}
                                                    </Typography>
                                                    <Box display="flex" gap={1} mb={1}>
                                                        <Chip label={formatFileSize(file.file_size)} size="small" />
                                                        <Chip label={formatDate(file.upload_date)} size="small" variant="outlined" />
                                                        <Chip 
                                                            icon={<Favorite />} 
                                                            label="Favoriet" 
                                                            size="small" 
                                                            color="secondary"
                                                        />
                                                    </Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Geüpload: {formatDate(file.upload_date)}
                                                    </Typography>
                                                </Box>
                                                <Box display="flex" gap={1}>
                                                    <IconButton
                                                        onClick={() => handleFavorite(file.id, file.is_favorite)}
                                                        color="secondary"
                                                        title="Verwijder van favorieten"
                                                    >
                                                        <Favorite />
                                                    </IconButton>
                                                    <IconButton
                                                        onClick={() => handlePrint(file)}
                                                        color="primary"
                                                        title="Voeg toe aan print wachtrij"
                                                    >
                                                        <Print />
                                                    </IconButton>
                                                    <IconButton
                                                        href={`/api/files/${file.id}/download`}
                                                        title="Download bestand"
                                                    >
                                                        <Download />
                                                    </IconButton>
                                                    <IconButton
                                                        onClick={() => openDeleteDialog(file.id, file.original_filename || file.filename)}
                                                        color="error"
                                                        title="Verwijder bestand"
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </Grid>
                        ))}
                    </Grid>
                )}

                {/* Alle Bestanden Sectie */}
                <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2, display: 'flex', alignItems: 'center' }}>
                    <InsertDriveFile sx={{ mr: 1, color: 'primary.main' }} />
                    Alle Bestanden
                </Typography>

                {files.length === 0 ? (
                    <Card>
                        <CardContent sx={{ textAlign: 'center', py: 6 }}>
                            <CloudUpload sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" gutterBottom>
                                Nog geen bestanden geüpload
                            </Typography>
                            <Typography color="text.secondary" paragraph>
                                Upload je eerste G-code bestand om te beginnen
                            </Typography>
                            <Button
                                variant="contained"
                                startIcon={<CloudUpload />}
                                onClick={() => setUploadDialog(true)}
                            >
                                Eerste Bestand Uploaden
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Grid container spacing={2}>
                        {files.map((file, index) => (
                            <Grid item xs={12} key={`all-${file.id}`}>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.1 }}
                                >
                                    <Card sx={{ backgroundColor: file.is_favorite ? 'rgba(25, 118, 210, 0.04)' : 'inherit' }}>
                                        <CardContent>
                                            <Box display="flex" alignItems="center">
                                                <Code sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                                                <Box flex={1}>
                                                    <Typography variant="h6" gutterBottom>
                                                        {file.original_filename || file.filename}
                                                    </Typography>
                                                    <Box display="flex" gap={1} mb={1}>
                                                        <Chip label={formatFileSize(file.file_size)} size="small" />
                                                        <Chip label={formatDate(file.upload_date)} size="small" variant="outlined" />
                                                        {file.is_favorite && (
                                                            <Chip 
                                                                icon={<Favorite />} 
                                                                label="Favoriet" 
                                                                size="small" 
                                                                color="secondary"
                                                            />
                                                        )}
                                                    </Box>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Geüpload: {formatDate(file.upload_date)}
                                                    </Typography>
                                                </Box>
                                                <Box display="flex" gap={1}>
                                                    <IconButton
                                                        onClick={() => handleFavorite(file.id, file.is_favorite)}
                                                        color={file.is_favorite ? "secondary" : "default"}
                                                        title={file.is_favorite ? "Verwijder van favorieten" : "Voeg toe aan favorieten"}
                                                    >
                                                        {file.is_favorite ? <Favorite /> : <FavoriteBorder />}
                                                    </IconButton>
                                                    <IconButton
                                                        onClick={() => handlePrint(file)}
                                                        color="primary"
                                                        title="Voeg toe aan print wachtrij"
                                                    >
                                                        <Print />
                                                    </IconButton>
                                                    <IconButton
                                                        href={`/api/files/${file.id}/download`}
                                                        title="Download bestand"
                                                    >
                                                        <Download />
                                                    </IconButton>
                                                    <IconButton
                                                        onClick={() => openDeleteDialog(file.id, file.original_filename || file.filename)}
                                                        color="error"
                                                        title="Verwijder bestand"
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </motion.div>

            {/* Upload Dialog */}
            <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>G-code Bestand Uploaden</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Paper 
                            sx={{ 
                                p: 3, 
                                border: '2px dashed', 
                                borderColor: 'primary.main',
                                textAlign: 'center',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                            <Typography variant="h6" gutterBottom>
                                {selectedFile ? selectedFile.name : 'Klik om bestand te selecteren'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Alleen .bgcode, .gcode en .g bestanden zijn toegestaan
                            </Typography>
                            {selectedFile && (
                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                    Grootte: {formatFileSize(selectedFile.size)}
                                </Typography>
                            )}
                        </Paper>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".bgcode,.gcode,.g"
                            style={{ display: 'none' }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUploadDialog(false)}>
                        Annuleren
                    </Button>
                    <Button 
                        onClick={handleUpload} 
                        variant="contained"
                        disabled={!selectedFile || uploading}
                    >
                        {uploading ? 'Uploaden...' : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog 
                open={deleteDialog.open} 
                onClose={() => setDeleteDialog({ open: false, fileId: null, fileName: '' })}
                maxWidth="sm" 
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center">
                        <Warning color="warning" sx={{ mr: 1 }} />
                        Bestand Verwijderen
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Weet je zeker dat je het bestand <strong>"{deleteDialog.fileName}"</strong> permanent wilt verwijderen?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Deze actie kan niet ongedaan worden gemaakt.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({ open: false, fileId: null, fileName: '' })}>
                        Annuleren
                    </Button>
                    <Button 
                        onClick={() => handleDelete(deleteDialog.fileId)} 
                        variant="contained"
                        color="error"
                        startIcon={<Delete />}
                    >
                        Verwijderen
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Success Message Snackbar */}
            <Snackbar
                open={!!successMessage}
                autoHideDuration={4000}
                onClose={() => setSuccessMessage('')}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert 
                    onClose={() => setSuccessMessage('')} 
                    severity="success" 
                    sx={{ width: '100%' }}
                    variant="filled"
                >
                    {successMessage}
                </Alert>
            </Snackbar>

            {/* Print Dialog */}
            <Dialog 
                open={printDialog.open} 
                onClose={() => setPrintDialog({ open: false, file: null })} 
                maxWidth="sm" 
                fullWidth
            >
                <DialogTitle>
                    Bestand Printen
                    <IconButton
                        onClick={() => setPrintDialog({ open: false, file: null })}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {printDialog.file && (
                        <Box sx={{ mt: 1 }}>
                            <Typography variant="h6" gutterBottom>
                                {printDialog.file.original_filename || printDialog.file.filename}
                            </Typography>
                            
                            <TextField
                                select
                                fullWidth
                                label="Printer"
                                value={printer}
                                onChange={(e) => setPrinter(e.target.value)}
                                margin="normal"
                                required
                            >
                                <MenuItem value="auto">Automatisch toewijzen</MenuItem>
                                <MenuItem value="1">Printer 1</MenuItem>
                                <MenuItem value="2">Printer 2</MenuItem>
                                <MenuItem value="3">Printer 3</MenuItem>
                            </TextField>

                            <TextField
                                select
                                fullWidth
                                label="Prioriteit"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                margin="normal"
                            >
                                <MenuItem value="low">Laag</MenuItem>
                                <MenuItem value="normal">Normaal</MenuItem>
                                <MenuItem value="high">Hoog</MenuItem>
                            </TextField>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={filamentChange}
                                        onChange={(e) => setFilamentChange(e.target.checked)}
                                    />
                                }
                                label="Filament wissel vereist"
                                sx={{ mt: 2, mb: 1 }}
                            />

                            <TextField
                                fullWidth
                                label="Notities (optioneel)"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                multiline
                                rows={3}
                                margin="normal"
                                placeholder="Voeg eventuele opmerkingen toe..."
                            />

                            {printError && (
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    {printError}
                                </Alert>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setPrintDialog({ open: false, file: null })}>
                        Annuleren
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handlePrintSubmit}
                        disabled={!printer}
                        startIcon={<Print />}
                    >
                        Printen
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default FilesPage;
