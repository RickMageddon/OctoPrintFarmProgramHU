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

// Home all axes on specific printer
router.post('/:id/home', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const result = await octoprintService.homeAxes(printerId);

        // Log the action
        const db = req.app.locals.db;
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'home_axes',
                `Homed all axes on printer ${printerId}`,
                req.ip
            ]
        );

        res.json(result);
    } catch (error) {
        console.error(`Error homing printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to home axes' });
    }
});

// Send custom command to printer
router.post('/:id/command', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);
        const { command } = req.body;

        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const result = await octoprintService.sendCommand(printerId, command);

        // Log the action
        const db = req.app.locals.db;
        await db.run(
            `INSERT INTO session_logs (user_id, action, details, ip_address) 
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                'custom_command',
                `Sent command: ${command} to printer ${printerId}`,
                req.ip
            ]
        );

        res.json(result);
    } catch (error) {
        console.error(`Error sending command to printer ${req.params.id}:`, error);
        res.status(500).json({ error: error.message || 'Failed to send command' });
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

// Open printer settings (redirect to OctoPrint web interface)
router.post('/:id/settings', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        const printerId = parseInt(req.params.id);
        if (isNaN(printerId) || printerId < 1 || printerId > 3) {
            return res.status(400).json({ error: 'Invalid printer ID' });
        }

        const octoprintService = req.app.locals.octoprintService;
        const printer = octoprintService.getPrinter(printerId);
        
        if (!printer) {
            return res.status(404).json({ error: 'Printer not found' });
        }

        // Return the OctoPrint URL for the frontend to open
        const octoprintUrl = printer.url.replace(':80', ''); // Remove port if it's 80
        
        res.json({ 
            success: true, 
            message: 'Settings URL generated',
            url: octoprintUrl,
            printerName: printer.name
        });
    } catch (error) {
        console.error(`Error getting settings for printer ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to open printer settings' });
    }
});

// Reload OctoPrint API keys (admin only)
router.post('/reload-api-keys', requireAuth, requireVerifiedEmail, async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Admin privileges required' });
        }

        const octoprintService = req.app.locals.octoprintService;
        octoprintService.reloadApiKeys();

        res.json({ 
            success: true, 
            message: 'OctoPrint API keys reloaded successfully' 
        });
    } catch (error) {
        console.error('Error reloading API keys:', error);
        res.status(500).json({ error: 'Failed to reload API keys' });
    }
});

module.exports = router;
