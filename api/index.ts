import app from '../backend/app.js';
import { initDB } from '../backend/db.js';

// Initialize DB on first load of the serverless function
await initDB();

export default app;
