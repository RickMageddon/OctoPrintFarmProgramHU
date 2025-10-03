const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database/database.db');

console.log('Adding maintenance column to printer_status table...');

const db = new sqlite3.Database(dbPath);

db.run(`ALTER TABLE printer_status ADD COLUMN maintenance BOOLEAN DEFAULT 0`, (err) => {
    if (err) {
        if (err.message.includes('duplicate column name')) {
            console.log('✓ Maintenance column already exists');
        } else {
            console.error('Error adding maintenance column:', err.message);
            process.exit(1);
        }
    } else {
        console.log('✓ Maintenance column added successfully');
    }
    
    db.close();
});
