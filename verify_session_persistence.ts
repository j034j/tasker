

const API_URL = 'http://localhost:3000/api';

async function run() {
    try {
        console.log('1. Registering Organization...');
        const email = `test.user.${Date.now()}@example.com`;

        const orgRes = await fetch(`${API_URL}/orgs/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orgName: `Test Org ${Date.now()}`,
                userName: 'Test Admin',
                email,
                password: 'password123'
            })
        });

        if (!orgRes.ok) {
            console.error('Register Org Failed:', await orgRes.text());
            return;
        }

        const orgData = await orgRes.json();
        const token = orgData.token;
        const userId = orgData.userId;
        const orgId = orgData.orgId;
        console.log('   Logged in:', email, 'User:', userId);

        console.log('2. Creating Board...');
        const boardRes = await fetch(`${API_URL}/boards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: 'Session Test Board',
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

        console.log('3. Updating Last Board...');
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

        console.log('4. Logging out (simulation)...');

        console.log('5. Logging In Again...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'password123'
            })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        console.log('   Login Response LastBoardId:', loginData.user.lastBoardId);

        if (loginData.user.lastBoardId === boardId) {
            console.log('SUCCESS: Last Board ID persisted and returned correctly!');
        } else {
            console.error('FAILURE: Expected', boardId, 'but got', loginData.user.lastBoardId);
        }

    } catch (e: any) {
        console.error('Error:', e);
    }
}

run();

