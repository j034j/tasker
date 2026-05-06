import app from '../backend/app.js';
import { initDB } from '../backend/db.js';

// Initialize DB on first load of the serverless function
try {
    await initDB();
} catch (err) {
    console.error('FAILED TO INITIALIZE DB ON STARTUP:', err);
    // We don't throw here to allow the app to boot and show errors through health checks
}

export default app;
