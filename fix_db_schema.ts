import db from './backend/db.js';

async function fixSchema() {
    console.log('Applying Migration for phone_number...');
    try {
        await db.execute('ALTER TABLE users ADD COLUMN phone_number TEXT');
        console.log('Migration Applied: phone_number column added.');
    } catch (e: any) {
        if (e.message && e.message.includes('duplicate column')) {
            console.log('Column phone_number already exists.');
        } else {
            console.error('Migration Failed:', e);
        }
    }

    console.log('Verifying Schema...');
    try {
        const result = await db.query("PRAGMA table_info(users);");
        const columns = result.rows.map((r: any) => r.name);
        console.log('Columns in users table:', columns);
        if (columns.includes('phone_number')) {
            console.log('Verification SUCCESS: phone_number exists.');
        } else {
            console.error('Verification FAILED: phone_number missing.');
        }
    } catch (e) {
        console.error('Verification Error:', e);
    }
}

fixSchema();
