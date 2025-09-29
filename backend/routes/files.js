const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        // Ensure uploads go to the mounted volume at /app/uploads
        const uploadDir = path.join(process.cwd(), 'uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    // Allow .gcode, .bgcode, and .g files
    const allowedTypes = ['.gcode', '.bgcode', '.g'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only .gcode files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

// Middleware to check verified email
const requireVerifiedEmail = (req, res, next) => {
    if (req.user && req.user.email_verified) {
        return next();
    }
    res.status(403).json({ error: 'HU email verification required' });
};

// Get user's favorite files  
router.get('/user', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const files = await db.all(
            `SELECT id, filename, original_filename, file_size, upload_date 
             FROM user_favorites 
             WHERE user_id = ? 
             ORDER BY upload_date DESC`,
            [req.user.id]
        );

        res.json({ files });
    } catch (error) {
        console.error('Error getting user files:', error);
        res.status(500).json({ error: 'Failed to get user files' });
    }
});

// Get user's favorite files (legacy endpoint)
router.get('/favorites', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const favorites = await db.all(
            `SELECT id, filename, original_filename, file_size, upload_date 
             FROM user_favorites 
             WHERE user_id = ? 
             ORDER BY upload_date DESC`,
            [req.user.id]
        );

        res.json(favorites);
    } catch (error) {
        console.error('Error getting user favorites:', error);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

// Upload new file
router.post('/upload', requireAuth, requireVerifiedEmail, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const db = req.app.locals.db;
        const octoprintService = req.app.locals.octoprintService;

        // Check current favorites count
        const currentCount = await db.get(
            'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?',
            [req.user.id]
        );

        let favoriteToReplace = null;

        if (currentCount.count >= 15) {
            // Get oldest favorite for potential replacement
            favoriteToReplace = await db.get(
                `SELECT id, filename, original_filename, file_path 
                 FROM user_favorites 
                 WHERE user_id = ? 
                 ORDER BY upload_date ASC 
                 LIMIT 1`,
                [req.user.id]
            );

            // If replaceId is provided, use that specific favorite
            if (req.body.replaceId) {
                const specificFavorite = await db.get(
                    `SELECT id, filename, original_filename, file_path 
                     FROM user_favorites 
                     WHERE user_id = ? AND id = ?`,
                    [req.user.id, req.body.replaceId]
                );

                if (specificFavorite) {
                    favoriteToReplace = specificFavorite;
                } else {
                    return res.status(400).json({ error: 'Invalid favorite to replace' });
                }
            }

            if (!favoriteToReplace) {
                return res.status(400).json({ 
                    error: 'Maximum favorites reached. Please specify which favorite to replace.',
                    needsReplacement: true,
                    favorites: await db.all(
                        `SELECT id, filename, original_filename, upload_date 
                         FROM user_favorites 
                         WHERE user_id = ? 
                         ORDER BY upload_date DESC`,
                        [req.user.id]
                    )
                });
            }
        }

        // Estimate print time
        const estimatedTime = octoprintService.estimatePrintTime(req.file.size);

        // Add to favorites
        const result = await db.run(
            `INSERT INTO user_favorites 
             (user_id, filename, original_filename, file_path, file_size) 
             VALUES (?, ?, ?, ?, ?)`,
            [
                req.user.id,
                req.file.filename,
                req.file.originalname,
                req.file.path,
                req.file.size
            ]
        );

        // If we need to replace a favorite, delete the old one
        if (favoriteToReplace) {
            await db.run(
                'DELETE FROM user_favorites WHERE id = ?',
                [favoriteToReplace.id]
            );

            // Delete the old file
            try {
                await fs.unlink(favoriteToReplace.file_path);
            } catch (error) {
                console.error('Error deleting old file:', error);
            }
        }

        // Log the upload (skip if session_logs table doesn't exist)
        try {
            await db.run(
                `INSERT INTO session_logs (user_id, action, details, ip_address) 
                 VALUES (?, ?, ?, ?)`,
                [
                    req.user.id,
                    'file_uploaded',
                    `Uploaded file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`,
                    req.ip
                ]
            );
        } catch (logError) {
            console.warn('Could not log file upload (table may not exist):', logError.message);
            // Continue anyway - logging is not critical
        }

        res.json({
            success: true,
            file: {
                id: result.id,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                estimatedTime: estimatedTime
            },
            replaced: favoriteToReplace ? favoriteToReplace.original_filename : null
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        
        // Clean up uploaded file on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }
        }

        if (error.message === 'Only .gcode files are allowed') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to upload file' });
        }
    }
});

// Delete user file (new endpoint)
router.delete('/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        const db = req.app.locals.db;

        // Get file info first to check ownership and get file path
        const file = await db.get(
            'SELECT * FROM user_favorites WHERE id = ? AND user_id = ?',
            [fileId, req.user.id]
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found or you do not have permission to delete it' });
        }

        // Delete from database
        await db.run(
            'DELETE FROM user_favorites WHERE id = ? AND user_id = ?',
            [fileId, req.user.id]
        );

        // Delete physical file
        try {
            if (file.file_path && require('fs').existsSync(file.file_path)) {
                await require('fs').promises.unlink(file.file_path);
            }
        } catch (fsError) {
            console.warn('Could not delete physical file:', fsError.message);
            // Continue anyway, database record is already deleted
        }

        res.json({ success: true, message: 'File deleted successfully' });

    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Delete favorite file (legacy endpoint)
router.delete('/favorites/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const favoriteId = parseInt(req.params.id);
        
        if (isNaN(favoriteId)) {
            return res.status(400).json({ error: 'Invalid favorite ID' });
        }

        const db = req.app.locals.db;

        // Get the favorite to ensure it belongs to the user
        const favorite = await db.get(
            `SELECT id, filename, original_filename, file_path 
             FROM user_favorites 
             WHERE id = ? AND user_id = ?`,
            [favoriteId, req.user.id]
        );

        if (!favorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        // Delete from database
        await db.run(
            'DELETE FROM user_favorites WHERE id = ?',
            [favoriteId]
        );

        // Delete the file
        try {
            await fs.unlink(favorite.file_path);
        } catch (error) {
            console.error('Error deleting file:', error);
        }

        // Log the deletion
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'file_deleted',
                `Deleted favorite: ${favorite.original_filename}`,
                req.ip
            ]
        );

        res.json({ success: true, message: 'Favorite deleted successfully' });

    } catch (error) {
        console.error('Error deleting favorite:', error);
        res.status(500).json({ error: 'Failed to delete favorite' });
    }
});

// Download favorite file
router.get('/favorites/:id/download', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const favoriteId = parseInt(req.params.id);
        
        if (isNaN(favoriteId)) {
            return res.status(400).json({ error: 'Invalid favorite ID' });
        }

        const db = req.app.locals.db;

        // Get the favorite to ensure it belongs to the user
        const favorite = await db.get(
            `SELECT filename, original_filename, file_path 
             FROM user_favorites 
             WHERE id = ? AND user_id = ?`,
            [favoriteId, req.user.id]
        );

        if (!favorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        // Check if file exists
        try {
            await fs.access(favorite.file_path);
        } catch (error) {
            return res.status(404).json({ error: 'File not found on disk' });
        }

        // Send file
        res.download(favorite.file_path, favorite.original_filename);

    } catch (error) {
        console.error('Error downloading favorite:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Get file stats (admin only)
router.get('/stats', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const db = req.app.locals.db;

        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                AVG(file_size) as avg_size,
                COUNT(DISTINCT user_id) as users_with_files
            FROM user_favorites
        `);

        const topUsers = await db.all(`
            SELECT 
                u.username,
                COUNT(f.id) as file_count,
                SUM(f.file_size) as total_size
            FROM user_favorites f
            JOIN users u ON f.user_id = u.id
            GROUP BY u.id, u.username
            ORDER BY file_count DESC
            LIMIT 10
        `);

        res.json({
            ...stats,
            topUsers
        });

    } catch (error) {
        console.error('Error getting file stats:', error);
        res.status(500).json({ error: 'Failed to get file stats' });
    }
});

module.exports = router;
