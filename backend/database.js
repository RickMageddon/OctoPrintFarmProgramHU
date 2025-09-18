const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor(dbPath = './database/farm.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    // Ensure foreign keys are enforced in SQLite
                    this.db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
                        if (pragmaErr) {
                            console.error('Failed to enable foreign keys:', pragmaErr.message);
                        }
                        this.initializeTables().then(resolve).catch(reject);
                    });
                }
            });
        });
    }

    async initializeTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                github_id VARCHAR(50) UNIQUE NOT NULL,
                username VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                hu_email VARCHAR(255),
                email_verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255),
                is_admin BOOLEAN DEFAULT FALSE,
                github_organizations TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`,

            // User favorites table (max 10 per user)
            `CREATE TABLE IF NOT EXISTS user_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INTEGER,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Print queue table
            `CREATE TABLE IF NOT EXISTS print_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                printer_id INTEGER NOT NULL, -- 1, 2, or 3
                filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                status VARCHAR(50) DEFAULT 'queued', -- queued, printing, completed, failed, cancelled
                priority INTEGER DEFAULT 0,
                estimated_time INTEGER, -- in minutes
                actual_time INTEGER, -- in minutes
                progress REAL DEFAULT 0, -- 0-100
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                started_at DATETIME,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Printer status table
            `CREATE TABLE IF NOT EXISTS printer_status (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'offline', -- online, offline, printing, error
                current_job_id INTEGER,
                api_key VARCHAR(255),
                url VARCHAR(255),
                last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (current_job_id) REFERENCES print_queue (id)
            )`,

            // Pending registrations table for email verification before GitHub OAuth
            `CREATE TABLE IF NOT EXISTS pending_registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(255) UNIQUE NOT NULL,
                verification_code VARCHAR(10) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                verified BOOLEAN DEFAULT FALSE
            )`,

            // Session logs table for debugging
            `CREATE TABLE IF NOT EXISTS session_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action VARCHAR(255),
                details TEXT,
                ip_address VARCHAR(45),
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            )`
        ];

        for (const tableSQL of tables) {
            await this.run(tableSQL);
        }

        // Insert default printer configurations
        await this.initializePrinters();
        
        console.log('Database tables initialized successfully');
    }

    async initializePrinters() {
        const printers = [
            { id: 1, name: 'Prusa Printer 1', url: 'http://octoprint1:80' },
            { id: 2, name: 'Prusa Printer 2', url: 'http://octoprint2:80' },
            { id: 3, name: 'Prusa Printer 3', url: 'http://octoprint3:80' }
        ];

        for (const printer of printers) {
            await this.run(
                `INSERT OR IGNORE INTO printer_status (id, name, url) VALUES (?, ?, ?)`,
                [printer.id, printer.name, printer.url]
            );
        }
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('Database error:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('Database error:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('Database error:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database connection closed');
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;
