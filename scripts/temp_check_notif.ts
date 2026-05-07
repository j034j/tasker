import Database from 'better-sqlite3';
const db = new Database('tasker.db');
try {
    const info = db.prepare("PRAGMA table_info(notifications)").all() as any[];
    console.log('Notifications Table Info:', info.map(i => i.name));
} finally {
    db.close();
}
