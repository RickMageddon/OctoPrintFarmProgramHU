const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../database');

// Serve the live monitor HTML directly (no authentication required)
router.get('/', (req, res) => {
    // Try multiple possible paths
    const possiblePaths = [
        path.join(__dirname, '../../live-monitor.html'),
        path.join(process.cwd(), 'live-monitor.html'),
        path.join(__dirname, '../../../live-monitor.html')
    ];
    
    let htmlPath = null;
    for (const testPath of possiblePaths) {
        console.log('Testing path:', testPath);
        if (fs.existsSync(testPath)) {
            htmlPath = testPath;
            break;
        }
    }
    
    if (htmlPath) {
        console.log('Found live monitor at:', htmlPath);
        res.sendFile(path.resolve(htmlPath));
    } else {
        console.error('Live monitor file not found. Tried paths:', possiblePaths);
        res.status(404).send(`Live monitor not found. Tried: ${possiblePaths.join(', ')}`);
    }
});

// API endpoint for live monitor data
router.get('/data', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const octoprintService = req.app.locals.octoprintService;

        // Get real printer status from OctoPrint
        let printers = [];
        try {
            const printerStatuses = await octoprintService.getAllPrinterStatus();
            printers = printerStatuses.map(printer => ({
                id: printer.id,
                name: printer.name,
                status: printer.state?.text?.toLowerCase() || 'offline',
                bed_temp: Math.round(printer.temperature?.bed?.actual || 0),
                hotend_temp: Math.round(printer.temperature?.tool0?.actual || 0),
                current_print_job: printer.job?.job?.file?.name || null,
                print_progress: Math.round(printer.job?.progress?.completion || 0),
                estimated_time_remaining: printer.job?.progress?.printTimeLeft ? Math.round(printer.job.progress.printTimeLeft / 60) : 0
            }));
        } catch (printerError) {
            console.warn('Failed to get printer status, using demo data:', printerError.message);
        }

        // Get queue data from database
        let queue = [];
        try {
            queue = await db.all(`
                SELECT 
                    q.id,
                    q.filename,
                    q.priority,
                    q.estimated_time,
                    q.status,
                    q.created_at,
                    u.username,
                    u.study_direction
                FROM print_queue q
                LEFT JOIN users u ON q.user_id = u.id
                WHERE q.status IN ('queued', 'printing')
                ORDER BY 
                    CASE q.priority 
                        WHEN 'high' THEN 1 
                        WHEN 'normal' THEN 2 
                        WHEN 'low' THEN 3 
                    END,
                    q.created_at ASC
                LIMIT 10
            `);
        } catch (queueError) {
            console.warn('Failed to get queue data:', queueError.message);
            queue = [];
        }

        // Get statistics from database
        let stats = null;
        try {
            stats = await db.get(`
                SELECT 
                    COUNT(*) as total_prints_month,
                    AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100 as success_rate,
                    SUM(CASE WHEN status = 'completed' THEN print_time ELSE 0 END) as total_print_time_month
                FROM print_queue 
                WHERE created_at >= date('now', '-1 month')
            `);
        } catch (statsError) {
            console.warn('Failed to get stats:', statsError.message);
        }

        const activePrinters = printers.filter(p => p.status === 'printing').length;
        const totalPrinters = printers.length || 3;

        res.json({
            printers: printers.length > 0 ? printers : [
                { id: 1, name: 'Prusa Printer 1', status: 'offline', bed_temp: 0, hotend_temp: 0, current_print_job: null, print_progress: 0, estimated_time_remaining: 0 },
                { id: 2, name: 'Prusa Printer 2', status: 'offline', bed_temp: 0, hotend_temp: 0, current_print_job: null, print_progress: 0, estimated_time_remaining: 0 },
                { id: 3, name: 'Prusa Printer 3', status: 'offline', bed_temp: 0, hotend_temp: 0, current_print_job: null, print_progress: 0, estimated_time_remaining: 0 }
            ],
            queue: queue.map(item => ({
                ...item,
                user: {
                    username: item.username || 'Unknown',
                    study_direction: item.study_direction || 'Unknown'
                }
            })),
            stats: {
                total_prints_month: stats?.total_prints_month || 0,
                active_printers: activePrinters,
                total_printers: totalPrinters,
                queue_length: queue.length,
                success_rate: Math.round(stats?.success_rate || 0),
                total_print_time_month: Math.round((stats?.total_print_time_month || 0) / 60) // convert to hours
            },
            last_updated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching monitor data:', error);
        
        // Return demo data if database fails
        res.json({
            printers: [
                {
                    id: 1,
                    name: 'Prusa MK3S+ #1',
                    status: 'printing',
                    bed_temp: 60,
                    hotend_temp: 215,
                    current_print_job: 'phone_case_v2.gcode',
                    print_progress: 67,
                    estimated_time_remaining: 83
                },
                {
                    id: 2,
                    name: 'Prusa MK3S+ #2',
                    status: 'available',
                    bed_temp: 23,
                    hotend_temp: 25,
                    current_print_job: null,
                    print_progress: 0,
                    estimated_time_remaining: 0
                },
                {
                    id: 3,
                    name: 'Prusa MK3S+ #3',
                    status: 'offline',
                    bed_temp: 0,
                    hotend_temp: 0,
                    current_print_job: null,
                    print_progress: 0,
                    estimated_time_remaining: 0
                }
            ],
            queue: [
                {
                    id: 1,
                    filename: 'prototype_bracket.gcode',
                    priority: 'high',
                    estimated_time: 135,
                    status: 'printing',
                    user: { username: 'jan.janssen', study_direction: 'TI' }
                },
                {
                    id: 2,
                    filename: 'mini_figurine.gcode',
                    priority: 'normal',
                    estimated_time: 45,
                    status: 'queued',
                    user: { username: 'sarah.devries', study_direction: 'AI' }
                },
                {
                    id: 3,
                    filename: 'enclosure_box.gcode',
                    priority: 'low',
                    estimated_time: 210,
                    status: 'queued',
                    user: { username: 'mike.peters', study_direction: 'SD' }
                },
                {
                    id: 4,
                    filename: 'sensor_housing.gcode',
                    priority: 'normal',
                    estimated_time: 105,
                    status: 'queued',
                    user: { username: 'lisa.vandijk', study_direction: 'CSC' }
                }
            ],
            stats: {
                total_prints_month: 47,
                active_printers: 1,
                total_printers: 3,
                queue_length: 4,
                success_rate: 98,
                total_print_time_month: 127
            },
            last_updated: new Date().toISOString()
        });
    }
});

module.exports = router;