const Database = require('../database');
const path = require('path');

async function setupDatabase() {
    console.log('🗄️  Setting up HU OctoPrint Farm Database...');
    
    try {
        const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database/farm.db');
        const db = new Database(dbPath);
        
        console.log('📡 Connecting to database...');
        await db.connect();
        
        console.log('✅ Database setup completed successfully!');
        console.log('');
        console.log('Database location:', dbPath);
        console.log('');
        console.log('Tables created:');
        console.log('  ✓ users - User accounts and GitHub info');
        console.log('  ✓ user_favorites - User favorite files (max 10)');
        console.log('  ✓ print_queue - Print job queue');
        console.log('  ✓ printer_status - Printer status tracking');
        console.log('  ✓ session_logs - User activity logs');
        console.log('');
        console.log('Default printers initialized:');
        console.log('  ✓ Printer 1 - Prusa Printer 1');
        console.log('  ✓ Printer 2 - Prusa Printer 2');
        console.log('  ✓ Printer 3 - Prusa Printer 3');
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;
