require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');

const Database = require('./database');
const authRoutes = require('./routes/auth');
const printerRoutes = require('./routes/printers');
const fileRoutes = require('./routes/files');
const queueRoutes = require('./routes/queue');
const userRoutes = require('./routes/users');
const OctoPrintService = require('./services/octoprintService');
const EmailService = require('./services/emailService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// Initialize services
const db = new Database(process.env.DATABASE_PATH);
const octoprintService = new OctoPrintService(db);
const emailService = new EmailService();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || "http://localhost:3000",
        "http://3dprinters:3000", // Add Docker frontend URL
        "http://localhost:3000"
    ],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads with CORS headers
app.use('/uploads', (req, res, next) => {
    // Set CORS headers for static files
    const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        'http://3dprinters:3000',
        'http://localhost:3000'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static('uploads'));

// If behind a proxy (nginx), trust it so secure cookies can work correctly
app.set('trust proxy', 1);

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    name: 'printmeister.sid', // Custom session name
    cookie: {
        // Use explicit override if provided, else default to production
        secure: (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production'),
        httpOnly: true, // Prevent XSS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax' // Help with CORS issues
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// GitHub OAuth Strategy - New flow: GitHub info is stored temporarily, not for user creation
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `http://3dprinters:3001/api/auth/github/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Store GitHub profile info temporarily for the callback route to handle
        // The actual user linking is handled in the auth route
        return done(null, {
            id: profile.id,
            username: profile.username,
            emails: profile.emails || [],
            accessToken: accessToken
        });
    } catch (error) {
        console.error('GitHub strategy error:', error);
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    console.log('🔐 Serializing user:', user);
    // Check if it's a GitHub profile (temporary) or a database user
    if (user.github_id) {
        // This is a database user - use database ID
        console.log('📝 Serializing database user ID:', user.id);
        done(null, { type: 'db', id: user.id });
    } else {
        // This is a GitHub profile - use GitHub ID for temporary storage
        console.log('📝 Serializing GitHub profile ID:', user.id);
        done(null, { type: 'github', id: user.id });
    }
});

passport.deserializeUser(async (data, done) => {
    try {
        console.log('🔍 Deserializing user with data:', data);
        
        // Check if database is connected
        if (!db.db) {
            console.error('❌ Database not connected in deserializeUser');
            return done(new Error('Database not connected'), null);
        }
        
        let user;
        if (data.type === 'db') {
            // Look up by database ID
            user = await db.get('SELECT * FROM users WHERE id = ?', [data.id]);
            console.log('✅ Database user deserialized:', user ? user.email : 'not found');
        } else if (data.type === 'github') {
            // Look up by GitHub ID
            user = await db.get('SELECT * FROM users WHERE github_id = ?', [data.id]);
            console.log('✅ GitHub user deserialized:', user ? user.email : 'not found');
        } else {
            // Legacy support - assume it's a database ID
            user = await db.get('SELECT * FROM users WHERE id = ?', [data]);
            console.log('✅ Legacy user deserialized:', user ? user.email : 'not found');
        }
        
        done(null, user);
    } catch (error) {
        console.error('❌ Error deserializing user:', error);
        done(error, null);
    }
});

// Make services available to routes
app.locals.db = db;
app.locals.octoprintService = octoprintService;
app.locals.emailService = emailService;
app.locals.io = io;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/users', userRoutes);

// Monitor routes - split HTML and API
const monitorRoutes = require('./routes/monitor');
app.use('/monitor', monitorRoutes); // HTML page at /monitor
app.use('/api/monitor', monitorRoutes); // API endpoints at /api/monitor/data

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Real-time updates via Socket.IO
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join-room', (room) => {
        socket.join(room);
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Background job to monitor printer status
cron.schedule('*/30 * * * * *', async () => {
    try {
        await octoprintService.updateAllPrinterStatus();
        const printerStatus = await octoprintService.getAllPrinterStatus();
        io.emit('printer-status-update', printerStatus);

        // Haal ook de monitor data op en emit deze
        // Simuleer een express-like req/res voor monitor.js
        const db = app.locals.db;
        const octoprintService = app.locals.octoprintService;
        let monitorData = {};
        try {
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
                printers = [];
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
                stats = null;
            }

            const activePrinters = printers.filter(p => p.status === 'printing').length;
            const totalPrinters = printers.length || 3;

            monitorData = {
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
                    total_print_time_month: Math.round((stats?.total_print_time_month || 0) / 60)
                },
                last_updated: new Date().toISOString()
            };
        } catch (err) {
            monitorData = {};
        }
        io.emit('monitor-update', monitorData);
    } catch (error) {
        console.error('Error updating printer status:', error);
    }
});

// Background job to process print queue (enabled by default)
global.autoProcessingEnabled = true;
console.log('✅ Automatic queue processing is ENABLED by default. Checking queue every 10 seconds.');

cron.schedule('*/10 * * * * *', async () => {
    if (!global.autoProcessingEnabled) {
        // Skip automatic processing - only process manually triggered
        return;
    }
    
    try {
        console.log('🔄 Running automatic queue processing...');
        await octoprintService.processQueue();
    } catch (error) {
        console.error('❌ Error processing queue:', error);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
    try {
        console.log('🔌 Connecting to database...');
        await db.connect();
        console.log('✅ Database connected successfully');
        
        // Clear print queue on startup to ensure fresh start
        console.log('🧹 Clearing print queue on startup...');
        try {
            const result = await db.run(`
                UPDATE print_queue 
                SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP 
                WHERE status IN ('queued', 'printing')
            `);
            if (result.changes > 0) {
                console.log(`✅ Cleared ${result.changes} jobs from print queue`);
            } else {
                console.log('✅ No jobs to clear from print queue');
            }
        } catch (clearError) {
            console.error('⚠️ Error clearing print queue:', clearError);
            // Continue startup even if clearing fails
        }
        
        server.listen(PORT, () => {
            console.log(`🚀 OctoPrint Farm Backend running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📊 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    try {
        await db.close();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

startServer();
