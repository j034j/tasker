import Database from 'better-sqlite3';
const db = new Database('tasker.db');
try {
    const info = db.prepare("PRAGMA table_info(tasks)").all() as any[];
    console.log('Tasks Table Info:', info.map(i => i.name));

    const boardsInfo = db.prepare("PRAGMA table_info(boards)").all() as any[];
    console.log('Boards Table Info:', boardsInfo.map(i => i.name));

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    console.log('All Tables:', tables.map(t => t.name));
} finally {
    db.close();
}
