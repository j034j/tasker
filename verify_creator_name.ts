
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';
// Use existing user or create one? 
// Let's create a temp org and user to be sure.
const EMAIL = `test_creator_${Date.now()}@example.com`;
const PASSWORD = 'password123';
const ORG_NAME = `CreatorTestOrg_${Date.now()}`;
const USER_NAME = 'Creator Bob';

async function verify() {
    try {
        console.log('1. Registering Organization...');
        const regRes = await axios.post(`${API_URL}/orgs/register`, {
            orgName: ORG_NAME,
            userName: USER_NAME,
            email: EMAIL,
            password: PASSWORD
        });
        const { token, orgId } = regRes.data;
        console.log('   Success! Token received.');

        console.log('2. Creating Board...');
        await axios.post(`${API_URL}/boards`, {
            name: 'Bob Board',
            orgId: orgId,
            isPublic: true
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('3. Fetching Boards...');
        const boardsRes = await axios.get(`${API_URL}/orgs/${orgId}/boards`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const board = boardsRes.data[0];

        console.log('   Fetched Board:', board.name);
        console.log('   Creator Name:', board.creator_name);

        if (board.creator_name === USER_NAME) {
            console.log('✅ PASS: Creator Name matches.');
        } else {
            console.error('❌ FAIL: Creator Name mismatch. Expected', USER_NAME, 'got', board.creator_name);
        }

    } catch (e: any) {
        console.error('❌ Error:', e.response?.data || e.message);
    }
}

verify();
