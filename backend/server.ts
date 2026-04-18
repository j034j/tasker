
import app from './app.js';
import { initDB } from './db.js';
import { logEmailConfigStatus } from './email.js';

const PORT = 3000;

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        logEmailConfigStatus();
    });
}).catch((err: unknown) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
