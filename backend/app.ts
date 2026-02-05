
import express from 'express';
import cors from 'cors';
import { router } from './routes';

import { initDB } from './db';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use('/api', router);

// Export app for Serverless
export default app;
