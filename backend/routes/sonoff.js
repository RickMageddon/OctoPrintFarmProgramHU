const express = require('express');
const router = express.Router();
const { requireAuth, requireVerifiedEmail, requireAdmin } = require('../middleware/auth');

// POST /api/sonoff/relay/:relayId/on - Turn relay ON
router.post('/relay/:relayId/on', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const relayId = parseInt(req.params.relayId);
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const result = await sonoffService.turnOn(relayId);
        
        // Log action to audit trail (if implemented)
        console.log(`👤 Admin ${req.user.username} turned ON relay ${relayId}`);
        
        res.json(result);
    } catch (error) {
        console.error('Error turning on relay:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sonoff/relay/:relayId/off - Turn relay OFF
router.post('/relay/:relayId/off', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const relayId = parseInt(req.params.relayId);
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const result = await sonoffService.turnOff(relayId);
        
        // Log action to audit trail (if implemented)
        console.log(`👤 Admin ${req.user.username} turned OFF relay ${relayId}`);
        
        res.json(result);
    } catch (error) {
        console.error('Error turning off relay:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sonoff/relay/:relayId/toggle - Toggle relay
router.post('/relay/:relayId/toggle', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const relayId = parseInt(req.params.relayId);
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const result = await sonoffService.toggle(relayId);
        
        // Log action to audit trail (if implemented)
        console.log(`👤 Admin ${req.user.username} toggled relay ${relayId} to ${result.state}`);
        
        res.json(result);
    } catch (error) {
        console.error('Error toggling relay:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sonoff/all/on - Turn all relays ON
router.post('/all/on', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const result = await sonoffService.turnAllOn();
        
        // Log action to audit trail (if implemented)
        console.log(`👤 Admin ${req.user.username} turned ON all relays`);
        
        res.json(result);
    } catch (error) {
        console.error('Error turning on all relays:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sonoff/all/off - Turn all relays OFF
router.post('/all/off', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const result = await sonoffService.turnAllOff();
        
        // Log action to audit trail (if implemented)
        console.log(`👤 Admin ${req.user.username} turned OFF all relays`);
        
        res.json(result);
    } catch (error) {
        console.error('Error turning off all relays:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sonoff/states - Get current relay states
router.get('/states', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const states = sonoffService.getStates();
        res.json({ success: true, states });
    } catch (error) {
        console.error('Error getting relay states:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sonoff/relay/:relayId/state - Get specific relay state
router.get('/relay/:relayId/state', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const relayId = parseInt(req.params.relayId);
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const state = sonoffService.getState(relayId);
        res.json({ success: true, relayId, state });
    } catch (error) {
        console.error('Error getting relay state:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sonoff/printer/:printerId/:action - Control printer power
router.post('/printer/:printerId/:action', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const printerId = parseInt(req.params.printerId);
        const action = req.params.action; // 'on' or 'off'
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const result = await sonoffService.controlPrinter(printerId, action);
        
        // Log action to audit trail (if implemented)
        console.log(`👤 Admin ${req.user.username} turned ${action.toUpperCase()} printer ${printerId}`);
        
        res.json(result);
    } catch (error) {
        console.error('Error controlling printer power:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sonoff/serial-ports - List available serial ports
router.get('/serial-ports', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // List USB serial devices
        const { stdout } = await execAsync('ls -1 /dev/ttyUSB* /dev/ttyACM* /dev/serial* 2>/dev/null || echo ""');
        const ports = stdout.trim().split('\n').filter(p => p.length > 0);
        
        res.json({ success: true, ports });
    } catch (error) {
        console.error('Error listing serial ports:', error);
        res.json({ success: true, ports: [] }); // Return empty array on error
    }
});

// GET /api/sonoff/config - Get current Sonoff configuration
router.get('/config', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        const config = sonoffService.getConfig();
        res.json({ success: true, config });
    } catch (error) {
        console.error('Error getting Sonoff config:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sonoff/config - Update Sonoff configuration
router.post('/config', requireAuth, requireVerifiedEmail, requireAdmin, async (req, res) => {
    try {
        const { serialPort, baudRate } = req.body;
        const sonoffService = req.app.locals.sonoffService;
        
        if (!sonoffService) {
            return res.status(503).json({ error: 'Sonoff service not available' });
        }
        
        sonoffService.updateConfig(serialPort, baudRate);
        
        console.log(`👤 Admin ${req.user.username} updated Sonoff config: ${serialPort} @ ${baudRate}`);
        
        res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
        console.error('Error updating Sonoff config:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
