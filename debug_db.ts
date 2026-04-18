
import db from './backend/db.js';

async function debug() {
    try {
        console.log('--- USERS ---');
        const users = await db.query('SELECT id, name, email, org_id, last_board_id FROM users');
        console.log(JSON.stringify(users.rows, null, 2));

        console.log('--- BOARDS ---');
        const boards = await db.query('SELECT id, name, org_id, created_by, followers FROM boards');
        console.log(JSON.stringify(boards.rows, null, 2));
    } catch (e) {
        console.error(e);
    }
}

debug();
