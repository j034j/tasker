
import db from './db.js';

async function migrate() {
    console.log('Migrating database...');
    try {
        await db.execute('ALTER TABLE users ADD COLUMN last_board_id TEXT DEFAULT NULL');
        console.log('Added last_board_id column to users table.');
    } catch (e: any) {
        if (e.message.includes('duplicate column name')) {
            console.log('Column last_board_id already exists.');
        } else {
            console.error('Migration failed:', e);
        }
    }
}

migrate();
