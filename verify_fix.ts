
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';
const EMAIL = `test_${Date.now()}@example.com`;
const PASSWORD = 'password123';
const ORG_NAME = `TestOrg_${Date.now()}`;

async function verify() {
    try {
        console.log('1. Registering Organization...');
        const regRes = await axios.post(`${API_URL}/orgs/register`, {
            orgName: ORG_NAME,
            userName: 'Test User',
            email: EMAIL,
            password: PASSWORD
        });
        const { token, orgId, userId } = regRes.data;
        console.log('   Success! Token received.');

        console.log('2. Creating Board...');
        const boardRes = await axios.post(`${API_URL}/boards`, {
            name: 'My New Board',
            orgId: orgId,
            isPublic: false
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const boardId = boardRes.data.id;
        console.log('   Board Created:', boardId);

        console.log('3. Verifying Board Followers...');
        const boardGetRes = await axios.get(`${API_URL}/boards/${boardId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const board = boardGetRes.data;

        console.log('   Board Followers:', board.followers);
        console.log('   User ID:', userId);

        if (board.followers && board.followers.includes(userId)) {
            console.log('✅ PASS: User is a follower of the created board.');
        } else {
            console.error('❌ FAIL: User is NOT a follower.');
        }

    } catch (e: any) {
        console.error('❌ Error:', e.response?.data || e.message);
    }
}

verify();
