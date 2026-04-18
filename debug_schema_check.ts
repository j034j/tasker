import db from './backend/db.js';

async function checkSchema() {
    console.log('Checking Users Table Schema...');
    try {
        const result = await db.query("PRAGMA table_info(users);");
        console.log(result.rows);
    } catch (e) {
        console.error('Error checking schema:', e);
    }
}

checkSchema();
