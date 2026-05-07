import Database from 'better-sqlite3';
const db = new Database('tasker.db');

// Check tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// Check if departments exists
const hasDepartments = tables.some(t => t.name === 'departments');
console.log('Departments table:', hasDepartments ? 'EXISTS' : 'MISSING');

if (!hasDepartments) {
    console.log('Creating departments table...');
    db.exec(`
        CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL,
            name TEXT NOT NULL,
            admin_user_id TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(org_id) REFERENCES organizations(id),
            FOREIGN KEY(admin_user_id) REFERENCES users(id)
        );
    `);
    console.log('Departments table created.');
}

// Check if boards has department_id column
const columns = db.prepare("PRAGMA table_info(boards)").all();
const hasDepartmentId = columns.some(c => c.name === 'department_id');
console.log('Boards has department_id:', hasDepartmentId ? 'YES' : 'NO');

if (!hasDepartmentId) {
    console.log('Adding department_id to boards...');
    db.exec('ALTER TABLE boards ADD COLUMN department_id TEXT;');
    console.log('Added department_id column.');
}

db.close();
console.log('Done!');