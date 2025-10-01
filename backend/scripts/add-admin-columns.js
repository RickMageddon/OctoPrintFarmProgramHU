#!/usr/bin/env node
// Migration: add admin management columns to users table
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '..', '..', 'database', 'database.db');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at', dbPath);
  process.exit(1);
}

console.log('📦 Adding admin management columns to users table...');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Failed to open database:', err.message);
    process.exit(1);
  }
});

// Check if columns exist first
db.all("PRAGMA table_info(users)", [], (err, rows) => {
  if (err) {
    console.error('❌ Failed to get table info:', err.message);
    db.close();
    process.exit(1);
  }

  const columns = rows.map(row => row.name);
  const columnsToAdd = [];

  if (!columns.includes('paused')) {
    columnsToAdd.push('ALTER TABLE users ADD COLUMN paused BOOLEAN DEFAULT 0');
  }
  if (!columns.includes('blocked')) {
    columnsToAdd.push('ALTER TABLE users ADD COLUMN blocked BOOLEAN DEFAULT 0');
  }
  if (!columns.includes('warning')) {
    columnsToAdd.push('ALTER TABLE users ADD COLUMN warning TEXT');
  }
  if (!columns.includes('github_org_member')) {
    columnsToAdd.push('ALTER TABLE users ADD COLUMN github_org_member BOOLEAN DEFAULT 0');
  }
  if (!columns.includes('github_organizations')) {
    columnsToAdd.push('ALTER TABLE users ADD COLUMN github_organizations TEXT');
  }

  if (columnsToAdd.length === 0) {
    console.log('✅ All admin columns already exist, no migration needed');
    db.close();
    return;
  }

  console.log(`📝 Adding ${columnsToAdd.length} column(s)...`);

  // Run all ALTER TABLE commands in series
  let completed = 0;
  columnsToAdd.forEach((sql) => {
    db.run(sql, (err) => {
      if (err) {
        console.error('❌ Failed to add column:', err.message);
        console.error('   SQL:', sql);
      } else {
        console.log('✅ Added column:', sql.match(/ADD COLUMN (\w+)/)[1]);
      }
      
      completed++;
      if (completed === columnsToAdd.length) {
        console.log('✅ Migration completed successfully!');
        db.close();
      }
    });
  });
});
