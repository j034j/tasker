import Database from 'better-sqlite3';
const db = new Database('tasker.db');
try {
    const info = db.prepare("PRAGMA table_info(users)").all() as any[];
    console.log('Users Table Info:', info.map(i => i.name));
} finally {
    db.close();
}
