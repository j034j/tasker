
import express from 'express';
import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
import { router } from './routes.js';

const app = express();
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,https://tasker-five-rose.vercel.app')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 300);
const rateBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_CLEANUP_INTERVAL_MS = 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateBucket.entries()) {
        if (value.resetAt <= now) {
            rateBucket.delete(key);
        }
    }
}, RATE_CLEANUP_INTERVAL_MS);
const isProduction = process.env.NODE_ENV === 'production';

const requestRateLimiter = (req: Request, res: Response, next: NextFunction) => {
    if (!isProduction) {
        const bypassPrefixes = ['/api/orgs/search', '/api/auth/email-verification/request', '/api/auth/email-verification/verify'];
        if (bypassPrefixes.some((prefix) => req.path.startsWith(prefix))) {
            return next();
        }
    }
    // On Vercel/serverless, use x-forwarded-for or x-real-ip, falling back to 'global' bucket
    // This prevents all requests from sharing one bucket due to undefined req.ip
    const forwardedFor = req.headers['x-forwarded-for'];
    let key: string;
    if (typeof forwardedFor === 'string' && forwardedFor) {
        key = forwardedFor.split(',')[0].trim();
    } else if (req.headers['x-real-ip']) {
        key = req.headers['x-real-ip'].toString();
    } else if (req.ip) {
        key = req.ip;
    } else {
        key = `global-${req.path}`;
    }
    
    const now = Date.now();
    const current = rateBucket.get(key);
    if (!current || current.resetAt <= now) {
        rateBucket.set(key, { count: 1, resetAt: now + rateWindowMs });
        return next();
    }
    if (current.count >= rateLimitMax) {
        console.log(`[RateLimit] BLOCKED - path: ${req.path}, key: ${key}, count: ${current.count}/${rateLimitMax}`);
        return res.status(429).json({ error: 'Too many requests. Please retry later.' });
    }
    current.count += 1;
    rateBucket.set(key, current);
    return next();
};

const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
};

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))) {
            return callback(null, true);
        }
        return callback(new Error('CORS origin denied'));
    },
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(securityHeaders);
app.use(requestRateLimiter);

app.use('/api', router);

// Development error handler: logs stack traces and returns error details in dev only
if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        console.error('Unhandled error:', err && err.stack ? err.stack : err);
        res.status(500).json({ error: String(err?.message || 'Internal Server Error'), stack: err?.stack });
    });
} else {
    app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        res.status(500).json({ error: 'Internal Server Error' });
    });
}

// Export app for Serverless
export default app;
