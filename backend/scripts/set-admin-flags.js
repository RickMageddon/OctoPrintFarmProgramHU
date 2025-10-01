#!/usr/bin/env node
// Utility: set-admin-flags.js
// Usage examples:
//  node set-admin-flags.js --username RickMageddon --org 1 --admin 1
//  node set-admin-flags.js --email foo@bar.com --org 1
//  node set-admin-flags.js --all --org 0 --admin 0

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

function usage() {
  console.log('Usage: node set-admin-flags.js [--username <username>] [--email <email>] [--id <userId>] [--all] [--org 0|1] [--admin 0|1] [--dry-run]');
  process.exit(1);
}

// Simple argument parser to avoid external deps
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    // flags
    if (key === 'all' || key === 'dry-run') {
      out[key] = true; continue;
    }
    // values
    const val = args[i+1];
    if (!val || val.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = val;
      i++;
    }
  }
  return out;
}

const argv = parseArgs();
const setOrg = (argv.org === undefined) ? null : (String(argv.org) === '1' ? 1 : 0);
const setAdmin = (argv.admin === undefined) ? null : (String(argv.admin) === '1' ? 1 : 0);
const dryRun = !!argv['dry-run'];

if (!argv.username && !argv.email && !argv.id && !argv.all) {
  console.error('Error: please provide --username, --email, --id or --all');
  usage();
}

if (setOrg === null && setAdmin === null) {
  console.error('Error: please provide at least --org or --admin to set');
  usage();
}

const dbPath = path.resolve(__dirname, '..', '..', 'database', 'database.db');
if (!fs.existsSync(dbPath)) {
  console.error('Database not found at', dbPath);
  process.exit(2);
}

// create a simple timestamped backup
const backupPath = dbPath + '.bak-' + new Date().toISOString().replace(/:/g, '-') + '.db';
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log('Backup created at', backupPath);
} catch (err) {
  console.error('Failed to create backup:', err.message);
  process.exit(3);
}

if (dryRun) console.log('Dry run mode - no changes will be written.');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(4);
  }
});

function buildAndRun() {
  let sql = 'UPDATE users SET ';
  const sets = [];
  const params = [];
  if (setOrg !== null) { sets.push('github_org_member = ?'); params.push(setOrg); }
  if (setAdmin !== null) { sets.push('is_admin = ?'); params.push(setAdmin); }
  sql += sets.join(', ');

  let where = '';
  if (argv.all) {
    where = '';
  } else if (argv.id) {
    where = ' WHERE id = ?'; params.push(argv.id);
  } else if (argv.username) {
    where = ' WHERE username = ?'; params.push(argv.username);
  } else if (argv.email) {
    where = ' WHERE email = ?'; params.push(argv.email);
  }

  sql += where;

  console.log('SQL:', sql);
  console.log('Params:', params);

  if (dryRun) {
    console.log('Dry-run complete. No changes applied.');
    db.close();
    process.exit(0);
  }

  db.run(sql, params, function (err) {
    if (err) {
      console.error('Update failed:', err.message);
      db.close();
      process.exit(5);
    }
    console.log(`Rows updated: ${this.changes}`);
    db.close();
  });
}

// Ensure minimist exists (it should not be required in the backend deps). If not, provide fallback parser.
try {
  buildAndRun();
} catch (err) {
  console.error('Unexpected error:', err.message);
  db.close();
  process.exit(10);
}
