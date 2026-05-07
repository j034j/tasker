
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('Missing required env var: JWT_SECRET. Set in .env file.');
}

export interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        orgId: string;
        role: string;
    };
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Missing token' });
    }

    Promise.resolve()
        .then(async () => {
            const payload = jwt.verify(token, JWT_SECRET) as JwtPayload & { userId?: string };
            if (!payload?.userId) {
                return res.status(401).json({ error: 'Invalid token payload' });
            }

            const userRow = (await db.query(
                'SELECT org_id, role FROM users WHERE id = ?',
                [payload.userId]
            )).rows[0] as { org_id?: string; role?: string } | undefined;

            if (!userRow?.org_id || !userRow?.role) {
                return res.status(401).json({ error: 'User not found' });
            }

            (req as AuthenticatedRequest).user = {
                userId: payload.userId,
                orgId: userRow.org_id,
                role: userRow.role
            };
            next();
        })
        .catch((err) => {
            console.error('Token verification failed:', err);
            return res.status(401).json({ error: 'Invalid or expired token' });
        });
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied: Super Admin only' });
    }
    next();
};

export const canAccessDept = async (userId: string, deptId: string): Promise<boolean> => {
    const user = first(asRows<{ role: string; org_id: string; department_id?: string | null }>(
        (await db.query('SELECT role, org_id, department_id FROM users WHERE id = ?', [userId])).rows
    ));
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'org_super_admin' || user.role === 'admin') return true;
    if (user.role === 'dept_admin') {
        const dept = first(asRows<{ admin_user_id: string }>(
            (await db.query('SELECT admin_user_id FROM departments WHERE id = ?', [deptId])).rows
        ));
        return dept?.admin_user_id === userId;
    }
    return false;
};

const asRows = <T extends Record<string, unknown>>(rows: Record<string, unknown>[]) => rows as T[];
const first = <T>(rows: T[]) => rows && rows.length > 0 ? rows[0] : undefined;

const getRequestIdentity = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
        ? forwarded[0]
        : typeof forwarded === 'string'
            ? forwarded.split(',')[0]?.trim()
            : '';
    return forwardedIp || req.ip || 'unknown';
};

const createRateLimiter = (windowMs: number, maxRequests: number, message: string) => {
    const bucket = new Map<string, { count: number; resetAt: number }>();
    const cleanupEvery = Math.max(1000, Math.floor(windowMs / 2));
    let lastCleanupAt = 0;

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        if (now - lastCleanupAt > cleanupEvery) {
            for (const [key, value] of bucket.entries()) {
                if (value.resetAt <= now) {
                    bucket.delete(key);
                }
            }
            lastCleanupAt = now;
        }

        const identity = getRequestIdentity(req);
        const current = bucket.get(identity);
        if (!current || current.resetAt <= now) {
            bucket.set(identity, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (current.count >= maxRequests) {
            return res.status(429).json({ error: message });
        }
        current.count += 1;
        bucket.set(identity, current);
        return next();
    };
};

export const loginRateLimiter = createRateLimiter(
    Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || 10 * 60 * 1000),
    Number(process.env.RATE_LIMIT_LOGIN_MAX || 20),
    'Too many login attempts. Please retry later.'
);

export const passwordResetRateLimiter = createRateLimiter(
    Number(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS || 15 * 60 * 1000),
    Number(process.env.RATE_LIMIT_PASSWORD_RESET_MAX || 8),
    'Too many password reset requests. Please retry later.'
);

export const translateRateLimiter = createRateLimiter(
    Number(process.env.RATE_LIMIT_TRANSLATE_WINDOW_MS || 5 * 60 * 1000),
    Number(process.env.RATE_LIMIT_TRANSLATE_MAX || 30),
    'Too many translation requests. Please retry later.'
);
