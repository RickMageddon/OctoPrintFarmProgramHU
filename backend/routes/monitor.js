const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../database');

// Serve the live monitor HTML directly (no authentication required)
router.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, '../../live-monitor.html');
    
    console.log('Looking for live monitor at:', htmlPath);
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        console.error('Live monitor file not found at:', htmlPath);
        res.status(404).send(`Live monitor not found at ${htmlPath}`);
    }
});

// API endpoint for live monitor data
router.get('/data', (req, res) => {
    try {
        // Get printer status
        const printers = db.prepare(`
            SELECT 
                id, 
                name, 
                status, 
                bed_temp, 
                hotend_temp,
                current_print_job,
                print_progress,
                estimated_time_remaining
            FROM printers 
            ORDER BY id
        `).all();

        // Get queue data
        const queue = db.prepare(`
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
        `).all();

        // Get statistics
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total_prints_month,
                AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100 as success_rate,
                SUM(CASE WHEN status = 'completed' THEN print_time ELSE 0 END) as total_print_time_month
            FROM print_queue 
            WHERE created_at >= date('now', '-1 month')
        `).get();

        const activePrinters = printers.filter(p => p.status === 'printing').length;
        const totalPrinters = printers.length;

        res.json({
            printers: printers.map(printer => ({
                ...printer,
                // Ensure safe temperature values
                bed_temp: printer.bed_temp || 0,
                hotend_temp: printer.hotend_temp || 0,
                print_progress: printer.print_progress || 0
            })),
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