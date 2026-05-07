import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const dbPath = 'tasker.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Check if user exists
const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get('test@test.com', 'testuser');
if (existing) {
    console.log('User already exists');
} else {
    // Create test organization
    const orgId = uuidv4();
    db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run(orgId, 'Test Organization');
    
    // Create test user with password 'password123'
    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync('password123', 10);
    db.prepare('INSERT INTO users (id, name, username, email, password_hash, org_id, role) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        userId, 'Test User', 'testuser', 'test@test.com', passwordHash, orgId, 'admin'
    );
    
    console.log('Created test user: testuser / password123');
    console.log('Also available: test@test.com / password123');
}

db.close();