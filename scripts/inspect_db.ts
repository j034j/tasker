
import db from '../backend/db';

async function inspect() {
    try {
        console.log("--- Organizations ---");
        const orgs = await db.query('SELECT * FROM organizations');
        console.table(orgs.rows);

        console.log("\n--- Users ---");
        const users = await db.query('SELECT id, name, email, org_id, role FROM users');
        console.table(users.rows);

        console.log("\n--- Boards ---");
        const boards = await db.query('SELECT id, name, org_id, created_by FROM boards');
        console.table(boards.rows);

    } catch (err) {
        console.error(err);
    }
}

inspect();
