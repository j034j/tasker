
import db from './db.js';

async function migrate() {
    console.log('Migrating database...');
    try {
        await db.execute('ALTER TABLE boards ADD COLUMN is_public INTEGER DEFAULT 0');
        console.log('Added is_public column to boards table.');
    } catch (e: any) {
        if (e.message.includes('duplicate column name')) {
            console.log('Column is_public already exists.');
        } else {
            console.error('Migration failed:', e);
        }
    }
}

migrate();
