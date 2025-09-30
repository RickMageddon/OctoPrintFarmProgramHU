const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'avatars');
        console.log('📁 Creating avatar upload directory:', uploadPath);
        if (!fs.existsSync(uploadPath)) {
            try {
                fs.mkdirSync(uploadPath, { recursive: true });
                console.log('✅ Avatar directory created successfully');
            } catch (error) {
                console.error('❌ Failed to create avatar directory:', error);
                return cb(error);
            }
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit for avatar images
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Alleen afbeeldingen zijn toegestaan (JPEG, PNG, GIF, WebP)'));
        }
    }
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    console.log('🔐 Detailed User route auth check:', {
        isAuthenticated: req.isAuthenticated(),
        hasSessionUser: !!req.session.user,
        passportUser: req.user ? req.user.email : 'none',
        sessionUser: req.session.user ? req.session.user.email : 'none',
        sessionId: req.sessionID,
        cookies: req.headers.cookie,
        userAgent: req.headers['user-agent'],
        url: req.url,
        method: req.method,
        sessionData: req.session ? {
            id: req.session.id,
            passport: req.session.passport,
            user: req.session.user ? {
                id: req.session.user.id,
                email: req.session.user.email,
                username: req.session.user.username
            } : null
        } : 'No session'
    });
    
    // Check both Passport authentication and session user
    if (req.isAuthenticated() || req.session.user) {
        // Ensure req.user is set for consistency
        if (!req.user && req.session.user) {
            req.user = req.session.user;
            console.log('✅ Set req.user from session:', req.user.email);
        }
        return next();
    }
    
    console.log('❌ User route authentication failed - detailed analysis:', {
        hasReqUser: !!req.user,
        hasSessionUser: !!req.session?.user,
        isAuthenticated: req.isAuthenticated(),
        sessionExists: !!req.session,
        sessionKeys: req.session ? Object.keys(req.session) : 'no session'
    });
    res.status(401).json({ error: 'Authentication required' });
};

// Middleware to check verified email
const requireVerifiedEmail = (req, res, next) => {
    if (req.user && req.user.email_verified) {
        return next();
    }
    res.status(403).json({ error: 'HU email verification required' });
};

// Middleware to check admin privileges
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.is_admin) {
        return next();
    }
    res.status(403).json({ error: 'Admin privileges required' });
};

// Get current user profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        const user = await db.get(`
            SELECT 
                id,
                github_id,
                username,
                email,
                email_verified,
                is_admin,
                study_direction,
                created_at,
                last_login,
                first_login_completed
            FROM users 
            WHERE id = ?
        `, [req.user.id]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);

    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// Get user statistics (separate endpoint)
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        // Get user statistics from print_queue
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_prints,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_prints,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_prints,
                SUM(CASE WHEN actual_time IS NOT NULL THEN actual_time ELSE 0 END) as total_print_time,
                AVG(CASE WHEN actual_time IS NOT NULL THEN actual_time ELSE NULL END) as average_print_time
            FROM print_queue 
            WHERE user_id = ?
        `, [req.user.id]);

        // Calculate success rate
        const successRate = stats.total_prints > 0 
            ? (stats.successful_prints / stats.total_prints) * 100 
            : 0;

        // Get total filament used (placeholder - would need to calculate from actual prints)
        const filamentUsed = stats.successful_prints * 15.5; // Rough estimate per successful print

        // Get favorites count
        const favoritesCount = await db.get(`
            SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?
        `, [req.user.id]);

        res.json({
            total_jobs: stats.total_prints || 0,
            completed_jobs: stats.successful_prints || 0,
            failed_jobs: stats.failed_prints || 0,
            total_print_time: stats.total_print_time || 0, // in minutes
            total_filament_used: filamentUsed || 0, // in grams
            average_print_time: Math.round(stats.average_print_time || 0),
            success_rate: Math.round(successRate * 10) / 10, // Round to 1 decimal
            favorites_count: favoritesCount.count || 0
        });

    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({ error: 'Failed to get user statistics' });
    }
});

// Get user print history
router.get('/history', requireAuth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const limit = parseInt(req.query.limit) || 10;
        
        const recent = await db.all(`
            SELECT 
                id,
                filename,
                status,
                actual_time as print_time,
                completed_at,
                created_at
            FROM print_queue 
            WHERE user_id = ? AND status IN ('completed', 'failed', 'cancelled')
            ORDER BY completed_at DESC
            LIMIT ?
        `, [req.user.id, limit]);

        res.json({ recent });

    } catch (error) {
        console.error('Error getting user history:', error);
        res.status(500).json({ error: 'Failed to get user print history' });
    }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const { study_direction, email } = req.body;
        
        await db.run(`
            UPDATE users 
            SET study_direction = ?, email = ?
            WHERE id = ?
        `, [study_direction, email, req.user.id]);

        // Update session
        req.session.user.study_direction = study_direction;
        req.session.user.email = email;

        res.json({ success: true, message: 'Profiel bijgewerkt' });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Upload avatar - Check auth before multer
router.post('/avatar', (req, res, next) => {
    console.log('🖼️ Avatar upload request initiated');
    console.log('📊 Request details:', {
        method: req.method,
        url: req.url,
        headers: {
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length'],
            userAgent: req.headers['user-agent'],
            cookie: req.headers.cookie ? 'present' : 'missing'
        },
        sessionId: req.sessionID,
        hasSession: !!req.session
    });
    next();
}, requireAuth, (req, res, next) => {
    console.log('🔐 Pre-upload auth check passed, proceeding with multer');
    console.log('👤 User authenticated:', {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username
    });
    upload.single('avatar')(req, res, next);
}, async (req, res) => {
    console.log('🖼️ Avatar upload request received in final handler');
    console.log('👤 User ID in handler:', req.user?.id);
    console.log('� User object in handler:', req.user);
    console.log('�📁 File info:', req.file ? {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
    } : 'No file');
    console.log('🔧 Request headers:', {
        contentType: req.headers['content-type'],
        authorization: req.headers.authorization,
        cookie: req.headers.cookie ? 'present' : 'missing'
    });

    try {
        if (!req.file) {
            console.log('❌ No file uploaded');
            return res.status(400).json({ error: 'Geen bestand geüpload' });
        }

        const db = req.app.locals.db;
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        console.log('🔗 Generated avatar URL:', avatarUrl);

        // Delete old avatar if exists
        const oldUser = await db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
        if (oldUser?.avatar_url && oldUser.avatar_url.startsWith('/uploads/avatars/')) {
            const oldPath = path.join(__dirname, '../../', oldUser.avatar_url);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
                console.log('🗑️ Deleted old avatar:', oldPath);
            }
        }

        // Update user with new avatar URL
        await db.run(
            'UPDATE users SET avatar_url = ? WHERE id = ?',
            [avatarUrl, req.user.id]
        );
        console.log('💾 Database updated with new avatar URL');

        // Update session
        req.session.user.avatar_url = avatarUrl;
        console.log('🔄 Session updated');

        console.log('✅ Avatar upload successful');
        res.json({
            success: true,
            message: 'Profielfoto bijgewerkt',
            avatar_url: avatarUrl
        });

    } catch (error) {
        console.error('💥 Error uploading avatar:', error);
        console.error('📋 Error stack:', error.stack);
        
        // Clean up uploaded file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            console.log('🗑️ Cleaned up uploaded file after error');
        }
        
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// Get all users (admin only)
router.get('/', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || '';

        let query = `
            SELECT 
                u.id,
                u.github_id,
                u.username,
                u.email,
                u.hu_email,
                u.email_verified,
                u.is_admin,
                u.created_at,
                u.last_login,
                COUNT(pq.id) as total_jobs,
                COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_jobs,
                COUNT(f.id) as favorites_count
            FROM users u
            LEFT JOIN print_queue pq ON u.id = pq.user_id
            LEFT JOIN user_favorites f ON u.id = f.user_id
        `;

        let params = [];

        if (search) {
            query += ' WHERE u.username LIKE ? OR u.email LIKE ? OR u.hu_email LIKE ?';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += `
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `;

        params.push(limit, offset);

        const users = await db.all(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM users';
        let countParams = [];

        if (search) {
            countQuery += ' WHERE username LIKE ? OR email LIKE ? OR hu_email LIKE ?';
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        const total = await db.get(countQuery, countParams);

        res.json({
            users,
            total: total.count,
            limit,
            offset
        });

    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Get user details (admin only)
router.get('/:id', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const db = req.app.locals.db;

        const user = await db.get(`
            SELECT 
                id,
                github_id,
                username,
                email,
                hu_email,
                email_verified,
                is_admin,
                created_at,
                last_login,
                github_organizations
            FROM users 
            WHERE id = ?
        `, [userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's recent activity
        const recentJobs = await db.all(`
            SELECT 
                id,
                printer_id,
                filename,
                status,
                created_at,
                started_at,
                completed_at
            FROM print_queue 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        `, [userId]);

        const recentLogs = await db.all(`
            SELECT 
                action,
                details,
                timestamp
            FROM session_logs 
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 20
        `, [userId]);

        const favorites = await db.all(`
            SELECT 
                id,
                filename,
                original_filename,
                file_size,
                upload_date
            FROM user_favorites 
            WHERE user_id = ?
            ORDER BY upload_date DESC
        `, [userId]);

        res.json({
            user,
            recentJobs,
            recentLogs,
            favorites
        });

    } catch (error) {
        console.error('Error getting user details:', error);
        res.status(500).json({ error: 'Failed to get user details' });
    }
});

// Update user admin status (admin only)
router.patch('/:id/admin', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { isAdmin } = req.body;

        if (isNaN(userId) || typeof isAdmin !== 'boolean') {
            return res.status(400).json({ error: 'Invalid user ID or admin status' });
        }

        // Prevent self-demotion
        if (userId === req.user.id && !isAdmin) {
            return res.status(400).json({ error: 'Cannot remove your own admin privileges' });
        }

        const db = req.app.locals.db;

        const result = await db.run(
            'UPDATE users SET is_admin = ? WHERE id = ?',
            [isAdmin, userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get updated user
        const user = await db.get(
            'SELECT username FROM users WHERE id = ?',
            [userId]
        );

        // Log the action
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'admin_status_changed',
                `${isAdmin ? 'Granted' : 'Revoked'} admin privileges for user ${user.username} (ID: ${userId})`,
                req.ip
            ]
        );

        res.json({ 
            success: true, 
            message: `Admin privileges ${isAdmin ? 'granted to' : 'revoked from'} ${user.username}` 
        });

    } catch (error) {
        console.error('Error updating admin status:', error);
        res.status(500).json({ error: 'Failed to update admin status' });
    }
});

// Delete user account (admin only)
router.delete('/:id', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Prevent self-deletion
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const db = req.app.locals.db;

        // Get user info before deletion
        const user = await db.get(
            'SELECT username, email FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's files to delete from disk
        const userFiles = await db.all(
            'SELECT file_path FROM user_favorites WHERE user_id = ?',
            [userId]
        );

        // Delete user (cascading will handle related records)
        await db.run('DELETE FROM users WHERE id = ?', [userId]);

        // Delete user's files from disk
        const fs = require('fs').promises;
        for (const file of userFiles) {
            try {
                await fs.unlink(file.file_path);
            } catch (error) {
                console.error(`Error deleting file ${file.file_path}:`, error);
            }
        }

        // Log the action
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'user_deleted',
                `Deleted user account: ${user.username} (${user.email})`,
                req.ip
            ]
        );

        res.json({ 
            success: true, 
            message: `User account ${user.username} deleted successfully` 
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user account' });
    }
});

// Get user activity logs (admin only)
router.get('/:id/logs', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const db = req.app.locals.db;

        const logs = await db.all(`
            SELECT 
                id,
                action,
                details,
                ip_address,
                timestamp
            FROM session_logs 
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        const total = await db.get(
            'SELECT COUNT(*) as count FROM session_logs WHERE user_id = ?',
            [userId]
        );

        res.json({
            logs,
            total: total.count,
            limit,
            offset
        });

    } catch (error) {
        console.error('Error getting user logs:', error);
        res.status(500).json({ error: 'Failed to get user activity logs' });
    }
});

// Get system statistics (admin only)
router.get('/admin/stats', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const db = req.app.locals.db;

        const userStats = await db.get(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN email_verified = 1 THEN 1 END) as verified_users,
                COUNT(CASE WHEN is_admin = 1 THEN 1 END) as admin_users,
                COUNT(CASE WHEN last_login >= date('now', '-7 days') THEN 1 END) as active_users_7d,
                COUNT(CASE WHEN last_login >= date('now', '-30 days') THEN 1 END) as active_users_30d
            FROM users
        `);

        const jobStats = await db.get(`
            SELECT 
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs,
                COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued_jobs,
                COUNT(CASE WHEN status = 'printing' THEN 1 END) as printing_jobs
            FROM print_queue
        `);

        const fileStats = await db.get(`
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                AVG(file_size) as avg_size
            FROM user_favorites
        `);

        const recentActivity = await db.all(`
            SELECT 
                u.username,
                sl.action,
                sl.details,
                sl.timestamp
            FROM session_logs sl
            JOIN users u ON sl.user_id = u.id
            ORDER BY sl.timestamp DESC
            LIMIT 20
        `);

        res.json({
            users: userStats,
            jobs: jobStats,
            files: fileStats,
            recentActivity
        });

    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({ error: 'Failed to get system statistics' });
    }
});

module.exports = router;
