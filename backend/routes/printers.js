const express = require('express');
const router = express.Router();

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

// Get all printer statuses
router.get('/status', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const octoprintService = req.app.locals.octoprintService;
        const statuses = await octoprintService.getAllPrinterStatus();
        res.json(statuses);
    } catch (error) {
        console.error('Error getting printer statuses:', error);
        res.status(500).json({ error: 'Failed to get printer statuses' });
    }
});

// Get specific printer status
router.get('/:id/status', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);
        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const status = await octoprintService.getPrinterStatus(printerId);
        res.json(status);
    } catch (error) {
        console.error(`Error getting printer ${req.params.id} status:`, error);
        res.status(500).json({ error: 'Failed to get printer status' });
    }
});

// Start print on specific printer
router.post('/:id/print', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);
        const { filename } = req.body;

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const result = await octoprintService.startPrint(printerId, filename);
        
        // Log the action
        const db = req.app.locals.db;
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'print_started',
                `Started print: ${filename} on printer ${printerId}`,
                req.ip
            ]
        );

        res.json(result);
    } catch (error) {
        console.error(`Error starting print on printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to start print' });
    }
});

// Cancel print on specific printer
router.post('/:id/cancel', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const result = await octoprintService.cancelPrint(printerId);
        
        // Log the action
        const db = req.app.locals.db;
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'print_cancelled',
                `Cancelled print on printer ${printerId}`,
                req.ip
            ]
        );

        res.json(result);
    } catch (error) {
        console.error(`Error cancelling print on printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to cancel print' });
    }
});

// Pause print on specific printer
router.post('/:id/pause', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const result = await octoprintService.pausePrint(printerId);

        res.json(result);
    } catch (error) {
        console.error(`Error pausing print on printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to pause print' });
    }
});

// Resume print on specific printer
router.post('/:id/resume', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const result = await octoprintService.resumePrint(printerId);

        res.json(result);
    } catch (error) {
        console.error(`Error resuming print on printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to resume print' });
    }
});

// Get files on specific printer
router.get('/:id/files', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const files = await octoprintService.getFiles(printerId);

        res.json(files);
    } catch (error) {
        console.error(`Error getting files from printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to get files' });
    }
});

// Delete file from specific printer (admin only)
router.delete('/:id/files/:filename', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const printerId = parseInt(req.params.id);
        const { filename } = req.params;

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const result = await octoprintService.deleteFile(printerId, filename);

        // Log the action
        const db = req.app.locals.db;
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'file_deleted',
                `Deleted file: ${filename} from printer ${printerId}`,
                req.ip
            ]
        );

        res.json(result);
    } catch (error) {
        console.error(`Error deleting file from printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to delete file' });
    }
});

module.exports = router;
