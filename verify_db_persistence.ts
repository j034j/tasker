
import db from './backend/db.js'; // Ensure we can import this (might be .ts vs .js issue with tsx)
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const API_URL = 'http://localhost:3000/api';

async function run() {
    try {
        console.log('1. Setting up Test User directly in DB...');
        const email = `direct_test_${Date.now()}@example.com`;
        const password = 'password123';
        const hashedPassword = bcrypt.hashSync(password, 10);
        const userId = uuidv4();
        const orgId = uuidv4();

        // 1. Create Org
        await db.execute('INSERT INTO organizations (id, name) VALUES (?, ?)', [orgId, `Direct Org ${Date.now()}`]);

        // 2. Create User
        await db.execute(
            'INSERT INTO users (id, name, email, password_hash, org_id, role) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, 'Direct Test User', email, hashedPassword, orgId, 'admin']
        );
        console.log('   User created:', email);

        // 3. Login via API
        console.log('2. Logging in via API to get token...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        console.log('   Logged in. Token received.');

        // 4. Create Board via API
        console.log('3. Creating Board via API...');
        const boardRes = await fetch(`${API_URL}/boards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: 'Direct Session Board',
                orgId: orgId,
                isPublic: false
            })
        });

        if (!boardRes.ok) {
            console.error('Create Board Failed:', await boardRes.text());
            return;
        }
        const boardData = await boardRes.json();
        const boardId = boardData.id;
        console.log('   Board Created:', boardId);

        // 5. Update Last Board via API
        console.log('4. Updating Last Board via API...');
        const updateRes = await fetch(`${API_URL}/users/me/board`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ boardId })
        });

        if (!updateRes.ok) {
            console.error('Update Last Board Failed:', await updateRes.text());
            return;
        }
        console.log('   Last Board Updated.');

        // 6. Verify DB State (Direct Check)
        const userRow = (await db.query('SELECT last_board_id FROM users WHERE id = ?', [userId])).rows[0];
        console.log('   DB Check: last_board_id =', userRow.last_board_id);

        if (userRow.last_board_id !== boardId) {
            console.error('FAILURE: DB does not match boardId!');
            return;
        }

        // 7. Login Again via API to verify response
        console.log('5. Logging in again to verify response...');
        const loginRes2 = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const loginData2 = await loginRes2.json();
        console.log('   Login Response LastBoardId:', loginData2.user.lastBoardId);

        if (loginData2.user.lastBoardId === boardId) {
            console.log('SUCCESS: Full Cycle Verified!');
        } else {
            console.error('FAILURE: API did not return correct lastBoardId');
        }

    } catch (e: any) {
        console.error('Error:', e);
    }
}

run();
