
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? 'dev_jwt_secret_change_me' : undefined);
if (!JWT_SECRET) {
    throw new Error('Missing required env var: JWT_SECRET');
}
if (!process.env.JWT_SECRET && !isProduction) {
    console.warn('JWT_SECRET not set. Using temporary development fallback secret.');
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

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        const payload = user as JwtPayload & { userId: string; orgId: string; role: string };
        if (!payload?.userId || !payload?.orgId || !payload?.role) {
            return res.status(401).json({ error: 'Invalid token payload' });
        }
        (req as AuthenticatedRequest).user = {
            userId: payload.userId,
            orgId: payload.orgId,
            role: payload.role
        };
        next();
    });
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (!user || user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied: Super Admin only' });
    }
    next();
};

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
