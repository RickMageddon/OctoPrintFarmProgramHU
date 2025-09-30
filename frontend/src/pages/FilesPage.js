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
    Paper
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
    Code
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
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef();

    // Fetch user's uploaded files
    const fetchFiles = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/files/user');
            setFiles(response.data.files || []);
        } catch (error) {
            console.error('Error fetching files:', error);
            setError('Kon bestanden niet laden');
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

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
        if (!window.confirm('Weet je zeker dat je dit bestand wilt verwijderen?')) {
            return;
        }

        try {
            await axios.delete(`/api/files/${fileId}`);
            fetchFiles(); // Refresh file list
        } catch (error) {
            console.error('Delete error:', error);
            setError('Kon bestand niet verwijderen');
        }
    };

    const handleFavorite = async (fileId, isFavorite) => {
        try {
            if (isFavorite) {
                await axios.delete(`/api/files/${fileId}/favorite`);
            } else {
                await axios.post(`/api/files/${fileId}/favorite`);
            }
            fetchFiles(); // Refresh file list
        } catch (error) {
            console.error('Favorite error:', error);
            setError('Kon favoriet status niet wijzigen');
        }
    };

    const handlePrint = async (fileId) => {
        try {
            await axios.post('/api/queue/add', {
                favoriteId: fileId, // Use favoriteId instead of fileId to match backend expectation
                priority: 'normal'
            });
            alert('Bestand toegevoegd aan print wachtrij!');
        } catch (error) {
            console.error('Print error:', error);
            setError('Kon bestand niet toevoegen aan wachtrij');
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
                    <Grid container spacing={3}>
                        {files.map((file, index) => (
                            <Grid item xs={12} key={file.id}>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: index * 0.1 }}
                                >
                                    <Card>
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
                                                        onClick={() => handlePrint(file.id)}
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
                                                        onClick={() => handleDelete(file.id)}
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
        </Container>
    );
};

export default FilesPage;
