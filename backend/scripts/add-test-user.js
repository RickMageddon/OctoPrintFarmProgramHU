#!/usr/bin/env node
// Add test user account to database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '..', '..', 'database', 'database.db');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found at', dbPath);
  process.exit(1);
}

console.log('👤 Adding test user account...');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ Failed to open database:', err.message);
    process.exit(1);
  }
});

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test.user@student.hu.nl',
  email_verified: 1,
  github_username: 'testuser-github',
  github_linked: 0,
  study_direction: 'TI',
  is_admin: 0,
  github_org_member: 0,
  paused: 0,
  blocked: 0,
  first_login_completed: 1
};

const sql = `
  INSERT INTO users (
    username, 
    email, 
    email_verified, 
    github_username, 
    github_linked, 
    study_direction, 
    is_admin, 
    github_org_member,
    paused,
    blocked,
    first_login_completed,
    created_at,
    last_login
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`;

db.run(sql, [
  testUser.username,
  testUser.email,
  testUser.email_verified,
  testUser.github_username,
  testUser.github_linked,
  testUser.study_direction,
  testUser.is_admin,
  testUser.github_org_member,
  testUser.paused,
  testUser.blocked,
  testUser.first_login_completed
], function(err) {
  if (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.log('⚠️  Test user already exists');
      
      // Update instead
      db.run(`UPDATE users SET 
        email_verified = ?,
        github_username = ?,
        study_direction = ?,
        is_admin = ?,
        github_org_member = ?,
        paused = ?,
        blocked = ?,
        first_login_completed = ?
        WHERE username = ?`,
        [
          testUser.email_verified,
          testUser.github_username,
          testUser.study_direction,
          testUser.is_admin,
          testUser.github_org_member,
          testUser.paused,
          testUser.blocked,
          testUser.first_login_completed,
          testUser.username
        ],
        (err) => {
          if (err) {
            console.error('❌ Failed to update test user:', err.message);
          } else {
            console.log('✅ Test user updated successfully!');
          }
          db.close();
        }
      );
    } else {
      console.error('❌ Failed to add test user:', err.message);
      db.close();
      process.exit(1);
    }
  } else {
    console.log('✅ Test user added successfully!');
    console.log('');
    console.log('Test User Details:');
    console.log('  Username:', testUser.username);
    console.log('  Email:', testUser.email);
    console.log('  GitHub:', testUser.github_username);
    console.log('  Study:', testUser.study_direction);
    console.log('  Admin:', testUser.is_admin ? 'Yes' : 'No');
    console.log('  User ID:', this.lastID);
    console.log('');
    console.log('You can now see this user in the admin panel!');
    db.close();
  }
});
