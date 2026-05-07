import Database from 'better-sqlite3';

// Check both databases
const locations = ['backend/tasker.db', 'tasker.db'];
for (const loc of locations) {
    console.log(`\n=== Checking ${loc} ===`);
    try {
        const db = new Database(loc, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log('Tables:', tables);
        if (tables.find(t => t.name === 'users')) {
            const users = db.prepare('SELECT id, email, username, name FROM users LIMIT 5').all();
            console.log('Users:', users);
        }
        db.close();
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}