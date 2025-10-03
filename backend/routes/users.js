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
    
    // Add multer error handling
    upload.single('avatar')(req, res, (err) => {
        if (err) {
            console.error('❌ Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'Bestand te groot (max 2MB)' });
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ error: 'Ongeldig bestandsveld' });
            } else {
                return res.status(400).json({ error: 'Upload fout: ' + err.message });
            }
        }
        next();
    });
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
        // Use relative URL so it works with nginx proxy in Docker and direct access
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        console.log('🔗 Generated avatar URL:', avatarUrl);

        // Delete old avatar if exists
        const oldUser = await db.get('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);
        if (oldUser?.avatar_url) {
            let oldFilePath;
            if (oldUser.avatar_url.startsWith('/uploads/avatars/')) {
                // Old relative path format
                oldFilePath = path.join(__dirname, '../../', oldUser.avatar_url);
            } else if (oldUser.avatar_url.includes('/uploads/avatars/')) {
                // New full URL format - extract just the filename
                const filename = oldUser.avatar_url.split('/uploads/avatars/').pop();
                oldFilePath = path.join(__dirname, '../../uploads/avatars', filename);
            }
            
            if (oldFilePath && fs.existsSync(oldFilePath)) {
                fs.unlinkSync(oldFilePath);
                console.log('🗑️ Deleted old avatar:', oldFilePath);
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
        const responseData = {
            success: true,
            message: 'Profielfoto bijgewerkt',
            avatar_url: avatarUrl
        };
        console.log('📤 Sending response:', responseData);
        res.json(responseData);

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
        const status = req.query.status || 'all';
        const study = req.query.study || 'all';
        const sort = req.query.sort || 'created_desc';

        let query = `
            SELECT 
                u.id,
                u.github_id,
                u.username,
                u.email,
                u.email_verified,
                u.is_admin,
                u.github_org_member,
                u.github_username,
                u.paused,
                u.blocked,
                u.warning,
                u.created_at,
                u.last_login,
                u.study_direction,
                COUNT(pq.id) as total_jobs,
                COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_jobs,
                COUNT(f.id) as favorites_count
            FROM users u
            LEFT JOIN print_queue pq ON u.id = pq.user_id
            LEFT JOIN user_favorites f ON u.id = f.user_id
        `;

        let where = [];
        let params = [];
        if (search) {
            where.push('(u.username LIKE ? OR u.email LIKE ?)');
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern);
        }
        if (status && status !== 'all') {
            if (status === 'admin') where.push('u.is_admin = 1');
            if (status === 'blocked') where.push('u.blocked = 1');
            if (status === 'paused') where.push('u.paused = 1');
            if (status === 'active') where.push('u.blocked = 0 AND u.paused = 0');
            if (status === 'github_linked') where.push('u.github_id IS NOT NULL');
            if (status === 'not_linked') where.push('u.github_id IS NULL');
        }
        if (study && study !== 'all') {
            where.push('u.study_direction = ?');
            params.push(study);
        }
        if (where.length > 0) {
            query += ' WHERE ' + where.join(' AND ');
        }

        query += ' GROUP BY u.id ';

        // Sorting
        const sortMap = {
            'created_desc': 'u.created_at DESC',
            'created_asc': 'u.created_at ASC',
            'name_asc': 'u.username COLLATE NOCASE ASC',
            'name_desc': 'u.username COLLATE NOCASE DESC',
            'email_asc': 'u.email COLLATE NOCASE ASC',
            'email_desc': 'u.email COLLATE NOCASE DESC',
            'lastlogin_desc': 'u.last_login DESC',
            'lastlogin_asc': 'u.last_login ASC',
            'prints_desc': 'total_jobs DESC',
            'prints_asc': 'total_jobs ASC'
        };
        query += ' ORDER BY ' + (sortMap[sort] || 'u.created_at DESC');
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const users = await db.all(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as count FROM users u';
        let countWhere = [];
        let countParams = [];
        if (search) {
            countWhere.push('(u.username LIKE ? OR u.email LIKE ?)');
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern);
        }
        if (status && status !== 'all') {
            if (status === 'admin') countWhere.push('u.is_admin = 1');
            if (status === 'blocked') countWhere.push('u.blocked = 1');
            if (status === 'paused') countWhere.push('u.paused = 1');
            if (status === 'active') countWhere.push('u.blocked = 0 AND u.paused = 0');
            if (status === 'github_linked') countWhere.push('u.github_id IS NOT NULL');
            if (status === 'not_linked') countWhere.push('u.github_id IS NULL');
        }
        if (study && study !== 'all') {
            countWhere.push('u.study_direction = ?');
            countParams.push(study);
        }
        if (countWhere.length > 0) {
            countQuery += ' WHERE ' + countWhere.join(' AND ');
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
                email_verified,
                is_admin,
                github_org_member,
                github_username,
                paused,
                blocked,
                warning,
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

// Pause/unpause user account (admin only)
router.post('/:id/pause', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { paused } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const pausedValue = paused ? 1 : 0;
        const db = req.app.locals.db;
        await db.run('UPDATE users SET paused = ? WHERE id = ?', [pausedValue, userId]);
        
        console.log(`Admin ${paused ? 'paused' : 'unpaused'} user ${userId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error pausing user:', error);
        res.status(500).json({ error: 'Failed to pause user' });
    }
});

// Block/unblock user account (admin only)
router.post('/:id/block', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { blocked } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const blockedValue = blocked ? 1 : 0;
        const db = req.app.locals.db;
        await db.run('UPDATE users SET blocked = ? WHERE id = ?', [blockedValue, userId]);
        
        console.log(`Admin ${blocked ? 'blocked' : 'unblocked'} user ${userId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: 'Failed to block user' });
    }
});
// Clear warning for current user
router.post('/clear-warning', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = req.app.locals.db;
        await db.run('UPDATE users SET warning = NULL WHERE id = ?', [userId]);
        // Update session user object if present
        if (req.session && req.session.user) {
            req.session.user.warning = null;
        }
        // Also update req.user object
        req.user.warning = null;
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing warning:', error);
        res.status(500).json({ error: 'Failed to clear warning' });
    }
});

// Set warning message for user (admin only)
router.post('/:id/warning', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { text } = req.body;
        
        if (isNaN(userId) || !text) {
            return res.status(400).json({ error: 'Invalid user ID or text' });
        }
        
        const db = req.app.locals.db;
        await db.run('UPDATE users SET warning = ? WHERE id = ?', [text, userId]);
        
        console.log(`Admin set warning for user ${userId}: ${text}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting warning:', error);
        res.status(500).json({ error: 'Failed to set warning' });
    }
});

// Reset GitHub login (admin only)
router.post('/:id/reset-github', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const db = req.app.locals.db;
        await db.run(
            'UPDATE users SET github_id = NULL, github_username = NULL, github_email = NULL, github_linked = 0 WHERE id = ?',
            [userId]
        );
        
        console.log(`Admin reset GitHub login for user ${userId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting GitHub login:', error);
        res.status(500).json({ error: 'Failed to reset GitHub login' });
    }
});

module.exports = router;
