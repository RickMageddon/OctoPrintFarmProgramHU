const express = require('express');
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    // Check both Passport authentication and session user
    if (req.isAuthenticated() || req.session.user) {
        // Ensure req.user is set for consistency
        if (!req.user && req.session.user) {
            req.user = req.session.user;
        }
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

// Get print queue
router.get('/', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        // Get all queue items with user information
        const queue = await db.all(`
            SELECT 
                pq.id,
                pq.user_id,
                pq.printer_id,
                pq.filename,
                pq.status,
                pq.priority,
                pq.estimated_time,
                pq.actual_time,
                pq.progress,
                pq.created_at,
                pq.started_at,
                pq.completed_at,
                u.username,
                ps.name as printer_name
            FROM print_queue pq
            JOIN users u ON pq.user_id = u.id
            LEFT JOIN printer_status ps ON pq.printer_id = ps.id
            ORDER BY 
                CASE pq.status 
                    WHEN 'printing' THEN 1
                    WHEN 'queued' THEN 2
                    WHEN 'completed' THEN 3
                    WHEN 'failed' THEN 4
                    WHEN 'cancelled' THEN 5
                END,
                pq.priority DESC,
                pq.created_at ASC
        `);

        res.json(queue);
    } catch (error) {
        console.error('Error getting print queue:', error);
        res.status(500).json({ error: 'Failed to get print queue' });
    }
});

// Add job to queue
router.post('/add', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const { favoriteId, fileId, printerId, printer, priority = 0 } = req.body;
        
        // Accept either favoriteId/fileId for flexibility
        const actualFileId = favoriteId || fileId;
        console.log(`[QUEUE] Add request - favoriteId: ${favoriteId}, fileId: ${fileId}, actualFileId: ${actualFileId}`);
        
        if (!actualFileId) {
            console.log('[QUEUE] Error: No file ID provided');
            return res.status(400).json({ error: 'File ID is required' });
        }

        const db = req.app.locals.db;
        const octoprintService = req.app.locals.octoprintService;

        // Auto-assign printer if not specified or set to 'auto'
        let actualPrinterId;
        if (!printerId && (!printer || printer === 'auto')) {
            // Find best available printer
            console.log('🔍 Auto-assigning printer...');
            
            try {
                const allPrinters = await octoprintService.getAllPrinterStatus();
                console.log('🖨️ Available printers:', allPrinters.map(p => ({ id: p.id, name: p.name, state: p.state?.text })));
                
                // Find operational printer with no active job
                const availablePrinter = allPrinters.find(printer => 
                    printer.state?.text === 'Operational' && 
                    !printer.job?.job?.file?.name
                );
                
                if (availablePrinter) {
                    actualPrinterId = availablePrinter.id;
                    console.log(`✅ Auto-assigned to printer ${actualPrinterId} (${availablePrinter.name})`);
                } else {
                    // No printer immediately available, assign to printer with least queue
                    const queueCounts = await Promise.all([1, 2, 3].map(async id => {
                        const count = await db.get(
                            'SELECT COUNT(*) as count FROM print_queue WHERE printer_id = ? AND status IN ("queued", "printing")',
                            [id]
                        );
                        return { id, count: count.count };
                    }));
                    
                    const leastBusyPrinter = queueCounts.reduce((min, current) => 
                        current.count < min.count ? current : min
                    );
                    
                    actualPrinterId = leastBusyPrinter.id;
                    console.log(`📋 No printer immediately available, assigned to least busy printer ${actualPrinterId} (queue: ${leastBusyPrinter.count})`);
                }
            } catch (error) {
                console.error('Error auto-assigning printer:', error);
                actualPrinterId = 1; // Fallback to printer 1
                console.log('⚠️ Fallback to printer 1 due to error');
            }
        } else {
            actualPrinterId = printerId || (printer === 'auto' ? 1 : parseInt(printer)) || 1;
        }

        if (actualPrinterId < 1 || actualPrinterId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        // Get the file - try both user_favorites and user_files tables
        let fileData = await db.get(
            `SELECT filename, original_filename, file_path, file_size 
             FROM user_favorites 
             WHERE id = ? AND user_id = ?`,
            [actualFileId, req.user.id]
        );

        // If not found in favorites, try user_files table
        if (!fileData) {
            fileData = await db.get(
                `SELECT filename, original_filename, file_path, file_size 
                 FROM user_files 
                 WHERE id = ? AND user_id = ?`,
                [actualFileId, req.user.id]
            );
        }

        console.log(`[QUEUE] File lookup result:`, fileData ? 'Found' : 'Not found');

        if (!fileData) {
            console.log(`[QUEUE] Error: File ${actualFileId} not found for user ${req.user.id}`);
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if user already has a job in queue for this printer
        const existingJob = await db.get(
            `SELECT id FROM print_queue 
             WHERE user_id = ? AND printer_id = ? AND status IN ('queued', 'printing')`,
            [req.user.id, actualPrinterId]
        );

        if (existingJob) {
            return res.status(400).json({ 
                error: 'You already have a job queued or printing on this printer' 
            });
        }


        // Estimate print time
        const estimatedTime = octoprintService.estimatePrintTime(fileData.file_size);

        // Check if print fits before 20:00
        const now = new Date();
        const shutdown = new Date(now);
        shutdown.setHours(20, 0, 0, 0);
        const minutesLeft = Math.floor((shutdown - now) / 60000);
        if (estimatedTime > minutesLeft) {
            return res.status(400).json({
                error: `Deze printopdracht past niet binnen de resterende tijd tot 20:00. Nog ${minutesLeft} minuten over, print duurt ~${estimatedTime} minuten.`
            });
        }

        // Add to queue
        const result = await db.run(
            `INSERT INTO print_queue 
             (user_id, printer_id, filename, file_path, priority, estimated_time) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                actualPrinterId,
                fileData.original_filename,
                fileData.file_path,
                priority,
                estimatedTime
            ]
        );

        // Log the action
        try {
            await db.run(
                `INSERT INTO session_logs (user_id, action, details, ip_address) 
                 VALUES (?, ?, ?, ?)`,
                [
                    req.user.id,
                    'job_queued',
                    `Queued ${fileData.original_filename} for printer ${actualPrinterId}`,
                    req.ip || '127.0.0.1'
                ]
            );
        } catch (logError) {
            console.warn('Could not log action:', logError.message);
        }

        // Emit socket event for real-time updates
        if (req.app.locals.io) {
            req.app.locals.io.emit('queue-updated', {
                action: 'added',
                jobId: result.lastID,
                userId: req.user.id,
                printerId: actualPrinterId
            });
        }

        // Trigger immediate queue processing
        try {
            console.log('🚀 Triggering immediate queue processing after job add...');
            const octoprintService = req.app.locals.octoprintService;
            if (octoprintService && global.autoProcessingEnabled) {
                setTimeout(async () => {
                    try {
                        await octoprintService.processQueue();
                    } catch (error) {
                        console.error('Error in immediate queue processing:', error);
                    }
                }, 1000); // Wait 1 second then process
            }
        } catch (error) {
            console.warn('Could not trigger immediate processing:', error);
        }

        res.json({
            success: true,
            jobId: result.lastID,
            message: 'Job added to queue',
            estimatedTime: estimatedTime
        });

    } catch (error) {
        console.error('Error adding job to queue:', error);
        res.status(500).json({ error: 'Failed to add job to queue' });
    }
});

// Cancel job from queue
router.delete('/:id', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const jobId = parseInt(req.params.id);
        
        if (isNaN(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID' });
        }

        const db = req.app.locals.db;

        // Get the job to verify ownership and status
        const job = await db.get(
            `SELECT id, user_id, printer_id, filename, status 
             FROM print_queue 
             WHERE id = ?`,
            [jobId]
        );

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check if user owns the job or is admin
        if (job.user_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Not authorized to cancel this job' });
        }

        // Can only cancel queued or printing jobs
        if (!['queued', 'printing'].includes(job.status)) {
            return res.status(400).json({ error: 'Can only cancel queued or printing jobs' });
        }

        // If job is currently printing, cancel it on the printer
        if (job.status === 'printing') {
            try {
                const octoprintService = req.app.locals.octoprintService;
                await octoprintService.cancelPrint(job.printer_id);
            } catch (error) {
                console.error('Error cancelling print on printer:', error);
                // Continue with database update even if printer cancel fails
            }
        }

        // Update job status to cancelled
        await db.run(
            'UPDATE print_queue SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['cancelled', jobId]
        );

        // Log the action
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'job_cancelled',
                `Cancelled job ${jobId}: ${job.filename}`,
                req.ip
            ]
        );

        // Emit socket event for real-time updates
        req.app.locals.io.emit('queue-updated', {
            action: 'cancelled',
            jobId: jobId,
            userId: req.user.id,
            printerId: job.printer_id
        });

        res.json({ success: true, message: 'Job cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling job:', error);
        res.status(500).json({ error: 'Failed to cancel job' });
    }
});

// Get user's queue history
router.get('/history', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const history = await db.all(`
            SELECT 
                pq.id,
                pq.printer_id,
                pq.filename,
                pq.status,
                pq.estimated_time,
                pq.actual_time,
                pq.progress,
                pq.created_at,
                pq.started_at,
                pq.completed_at,
                ps.name as printer_name
            FROM print_queue pq
            LEFT JOIN printer_status ps ON pq.printer_id = ps.id
            WHERE pq.user_id = ?
            ORDER BY pq.created_at DESC
            LIMIT ? OFFSET ?
        `, [req.user.id, limit, offset]);

        const total = await db.get(
            'SELECT COUNT(*) as count FROM print_queue WHERE user_id = ?',
            [req.user.id]
        );

        res.json({
            history,
            total: total.count,
            limit,
            offset
        });

    } catch (error) {
        console.error('Error getting queue history:', error);
        res.status(500).json({ error: 'Failed to get queue history' });
    }
});

// Get queue statistics (admin only)
router.get('/stats', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const db = req.app.locals.db;

        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs,
                COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued_jobs,
                COUNT(CASE WHEN status = 'printing' THEN 1 END) as printing_jobs,
                AVG(CASE WHEN actual_time IS NOT NULL THEN actual_time END) as avg_print_time,
                SUM(CASE WHEN actual_time IS NOT NULL THEN actual_time END) as total_print_time
            FROM print_queue
            WHERE created_at >= date('now', '-30 days')
        `);

        const printerStats = await db.all(`
            SELECT 
                ps.id,
                ps.name,
                COUNT(pq.id) as total_jobs,
                COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_jobs,
                AVG(CASE WHEN pq.actual_time IS NOT NULL THEN pq.actual_time END) as avg_print_time
            FROM printer_status ps
            LEFT JOIN print_queue pq ON ps.id = pq.printer_id 
                AND pq.created_at >= date('now', '-30 days')
            GROUP BY ps.id, ps.name
            ORDER BY ps.id
        `);

        const topUsers = await db.all(`
            SELECT 
                u.username,
                COUNT(pq.id) as total_jobs,
                COUNT(CASE WHEN pq.status = 'completed' THEN 1 END) as completed_jobs,
                SUM(CASE WHEN pq.actual_time IS NOT NULL THEN pq.actual_time END) as total_print_time
            FROM print_queue pq
            JOIN users u ON pq.user_id = u.id
            WHERE pq.created_at >= date('now', '-30 days')
            GROUP BY u.id, u.username
            ORDER BY total_jobs DESC
            LIMIT 10
        `);

        res.json({
            general: stats,
            printers: printerStats,
            topUsers: topUsers
        });

    } catch (error) {
        console.error('Error getting queue stats:', error);
        res.status(500).json({ error: 'Failed to get queue statistics' });
    }
});

// Modify job priority (admin only)
router.patch('/:id/priority', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const jobId = parseInt(req.params.id);
        const { priority } = req.body;

        if (isNaN(jobId) || priority === undefined) {
            return res.status(400).json({ error: 'Invalid job ID or priority' });
        }

        const db = req.app.locals.db;

        // Update priority
        const result = await db.run(
            'UPDATE print_queue SET priority = ? WHERE id = ? AND status = ?',
            [priority, jobId, 'queued']
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Job not found or not in queue' });
        }

        // Log the action
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'priority_changed',
                `Changed priority of job ${jobId} to ${priority}`,
                req.ip
            ]
        );

        // Emit socket event for real-time updates
        req.app.locals.io.emit('queue-updated', {
            action: 'priority_changed',
            jobId: jobId,
            priority: priority
        });

        res.json({ success: true, message: 'Priority updated successfully' });

    } catch (error) {
        console.error('Error updating job priority:', error);
        res.status(500).json({ error: 'Failed to update job priority' });
    }
});

// Trigger queue processing manually (for debugging)
router.post('/process', requireAuth, async (req, res) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const octoprintService = req.app.locals.octoprintService;
        console.log('🔧 Manually triggering queue processing...');
        
        await octoprintService.processQueue();
        
        res.json({ success: true, message: 'Queue processing triggered' });
    } catch (error) {
        console.error('Error manually processing queue:', error);
        res.status(500).json({ error: 'Failed to process queue' });
    }
});

// Enable/disable automatic queue processing
router.post('/auto-processing/:action', requireAuth, async (req, res) => {
    try {
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const action = req.params.action;
        const server = req.app.locals.server;
        
        if (action === 'enable') {
            global.autoProcessingEnabled = true;
            console.log('✅ Automatic queue processing ENABLED');
            res.json({ success: true, message: 'Automatic queue processing enabled', enabled: true });
        } else if (action === 'disable') {
            global.autoProcessingEnabled = false;
            console.log('❌ Automatic queue processing DISABLED');
            res.json({ success: true, message: 'Automatic queue processing disabled', enabled: false });
        } else {
            res.status(400).json({ error: 'Invalid action. Use "enable" or "disable"' });
        }
    } catch (error) {
        console.error('Error changing auto-processing setting:', error);
        res.status(500).json({ error: 'Failed to change auto-processing setting' });
    }
});

// Get current auto-processing status
router.get('/auto-processing/status', requireAuth, async (req, res) => {
    try {
        const enabled = global.autoProcessingEnabled || false;
        res.json({ enabled: enabled });
    } catch (error) {
        console.error('Error getting auto-processing status:', error);
        res.status(500).json({ error: 'Failed to get auto-processing status' });
    }
});

module.exports = router;
