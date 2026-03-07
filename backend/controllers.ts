import type { Request, Response } from 'express';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { DatabaseAdapter } from './db_adapter.js';
import { sendEmail, generateSixDigitCode, hashVerificationCode } from './email.js';

const isProduction = process.env.NODE_ENV === 'production';
const DEV_FALLBACK_JWT_SECRET = 'dev_jwt_secret_change_me';
const DEV_FALLBACK_SUPER_ADMIN_SECRET = 'dev_super_admin_secret_change_me';
const JWT_SECRET = process.env.JWT_SECRET || (!isProduction ? DEV_FALLBACK_JWT_SECRET : undefined);
const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 12);
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || (!isProduction ? DEV_FALLBACK_SUPER_ADMIN_SECRET : undefined);
const EMAIL_VERIFICATION_EXPIRES_HOURS = Number(process.env.EMAIL_VERIFICATION_EXPIRES_HOURS || 24);
const EMAIL_VERIFICATION_PURPOSE_REGISTER = 'register';

if (!JWT_SECRET) {
    throw new Error('Missing required env var: JWT_SECRET');
}
if (!SUPER_ADMIN_SECRET) {
    throw new Error('Missing required env var: SUPER_ADMIN_SECRET');
}
if (!process.env.JWT_SECRET && !isProduction) {
    console.warn('JWT_SECRET not set. Using temporary development fallback secret.');
}
if (!process.env.SUPER_ADMIN_SECRET && !isProduction) {
    console.warn('SUPER_ADMIN_SECRET not set. Using temporary development fallback secret.');
}


interface AuthenticatedRequest extends Request {
    user?: {
        userId: string;
        orgId: string;
        role: string;
    };
}

// Helper to get first row safely
const first = <T>(rows: T[]) => rows && rows.length > 0 ? rows[0] : undefined;
const asRows = <T extends Record<string, unknown>>(rows: Record<string, unknown>[]) => rows as T[];
const parseCsvIds = (value?: string | null): string[] => (
    value
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : []
);
type RecurringDutyInput = {
    title?: string;
    cadence?: 'daily' | 'weekly';
    dayOfWeek?: number | null;
    startTime?: string;
    endTime?: string;
    location?: string | null;
    notes?: string | null;
    active?: boolean;
};

type RecurringDutyRow = {
    id: string;
    user_id: string;
    title: string;
    cadence: 'daily' | 'weekly';
    day_of_week: number | null;
    start_time: string;
    end_time: string;
    location?: string | null;
    notes?: string | null;
    active: number | boolean;
};

type ReportingBoardRow = {
    id: string;
    name: string;
    created_at: string;
    created_by?: string | null;
    followers?: string | null;
    is_public: number | boolean;
    archived: number | boolean;
    creator_name?: string | null;
};

type ReportingTaskRow = {
    id: string;
    title: string;
    assigned_to?: string | null;
    interested_users?: string | null;
    due_date?: string | null;
    completed_at?: string | null;
    project_location?: string | null;
    priority_score?: number | string | null;
    urgency?: number | string | null;
    column_title: string;
};

type MemberOverviewRow = {
    id: string;
    name: string;
    email: string;
    role: string;
    phone_number?: string | null;
    skills?: string | null;
    location?: string | null;
};

type BoardFollowerRow = {
    id: string;
    name: string;
    followers?: string | null;
};

type MemberTaskRow = {
    id: string;
    title: string;
    assigned_to?: string | null;
    interested_users?: string | null;
    due_date?: string | null;
    completed_at?: string | null;
    project_location?: string | null;
    column_title: string;
    board_name: string;
};

type NotificationRecipient = {
    id: string;
    email: string;
    phone_number?: string | null;
    name: string;
};

type BoardAccessRow = {
    id: string;
    org_id: string;
    created_by?: string | null;
};

type DutySummary = {
    id: string;
    title: string;
    cadence: 'daily' | 'weekly';
    dayOfWeek: number | null;
    startTime: string;
    endTime: string;
    location: string | null;
    notes: string | null;
};

type BoardSummary = {
    id: string;
    name: string;
    creator_name: string;
    visibility: 'public' | 'private';
    archived: boolean;
    total_tasks: number;
    todo_tasks: number;
    in_progress_tasks: number;
    done_tasks: number;
    completion_rate: number;
    average_priority: number;
    participants: string[];
    locations: string[];
};

type RankedBoardSummary = BoardSummary & {
    ranking_score: number;
    priority_explanation: string;
};

type CompletedBoardSummary = BoardSummary & {
    completed_on: string;
};

type WeeklyTaskSummary = {
    id: string;
    board_id: string;
    board_name: string;
    title: string;
    status: 'completed' | 'in_progress' | 'not_started';
    due_date: string | null;
    completed_at: string | null;
    location: string | null;
    participants: string[];
    priority_score: number;
};

type MemberTaskSummary = {
    id: string;
    title: string;
    board_name: string;
    status: 'completed' | 'in_progress' | 'not_started';
    location: string | null;
    due_date: string | null;
    completed_at: string | null;
};

type MemberOverview = MemberOverviewRow & {
    followed_boards: { id: string; name: string }[];
    assigned_tasks_week: MemberTaskSummary[];
    interested_tasks_week: MemberTaskSummary[];
    active_tasks_week: MemberTaskSummary[];
    current_tasks_now: MemberTaskSummary[];
    recurring_duties: DutySummary[];
    recurring_duties_active_now: DutySummary[];
};

type TaskScopeRow = {
    task_id: string;
    board_id: string;
    org_id: string;
    created_by?: string | null;
};

const isValidTime = (time: string) => /^\d{2}:\d{2}$/.test(time);

const sanitizeRecurringDuties = (value: unknown): RecurringDutyInput[] => {
    if (!Array.isArray(value)) return [];
    const sanitized: RecurringDutyInput[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== 'object') continue;
        const entry = raw as RecurringDutyInput;
        const title = typeof entry.title === 'string' ? entry.title.trim() : '';
        const cadence = entry.cadence === 'weekly' ? 'weekly' : 'daily';
        const startTime = typeof entry.startTime === 'string' ? entry.startTime.trim() : '';
        const endTime = typeof entry.endTime === 'string' ? entry.endTime.trim() : '';
        if (!title || !isValidTime(startTime) || !isValidTime(endTime)) continue;
        const dayOfWeekValue = cadence === 'weekly' ? Number(entry.dayOfWeek) : null;
        if (cadence === 'weekly' && (dayOfWeekValue === null || Number.isNaN(dayOfWeekValue) || dayOfWeekValue < 0 || dayOfWeekValue > 6)) continue;
        sanitized.push({
            title,
            cadence,
            dayOfWeek: cadence === 'weekly' ? dayOfWeekValue : null,
            startTime,
            endTime,
            location: typeof entry.location === 'string' ? entry.location.trim() : null,
            notes: typeof entry.notes === 'string' ? entry.notes.trim() : null,
            active: entry.active !== false
        });
    }
    return sanitized.slice(0, 40);
};

const fetchRecurringDutiesByUserIds = async (userIds: string[]) => {
    const dutiesByUserId = new Map<string, DutySummary[]>();
    if (!userIds.length) return dutiesByUserId;
    const placeholders = userIds.map(() => '?').join(', ');
    const duties = asRows<RecurringDutyRow>((await db.query(
        `SELECT id, user_id, title, cadence, day_of_week, start_time, end_time, location, notes, active
         FROM user_recurring_duties
         WHERE user_id IN (${placeholders}) AND active = 1
         ORDER BY title ASC`,
        userIds
    )).rows);
    for (const duty of duties) {
        if (!dutiesByUserId.has(duty.user_id)) dutiesByUserId.set(duty.user_id, []);
        dutiesByUserId.get(duty.user_id)?.push({
            id: duty.id,
            title: duty.title,
            cadence: duty.cadence,
            dayOfWeek: duty.day_of_week,
            startTime: duty.start_time,
            endTime: duty.end_time,
            location: duty.location || null,
            notes: duty.notes || null
        });
    }
    return dutiesByUserId;
};

const isDoneColumnTitle = (title: string) => title.toLowerCase().includes('done');
const isTodoColumnTitle = (title: string) => {
    const normalized = title.toLowerCase();
    return normalized.includes('to do') || normalized.includes('todo');
};

const startOfWeek = (input?: string): Date => {
    if (input) {
        const parsed = new Date(`${input}T00:00:00.000Z`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const now = new Date();
    const utcDay = now.getUTCDay();
    const diffToMonday = (utcDay + 6) % 7;
    const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    weekStart.setUTCDate(weekStart.getUTCDate() - diffToMonday);
    return weekStart;
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const getWeekOfMonth = (date: Date): number => {
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const monthStartDay = monthStart.getUTCDay();
    const monthStartMondayOffset = (monthStartDay + 6) % 7;
    const dayOfMonth = date.getUTCDate();
    return Math.floor((dayOfMonth + monthStartMondayOffset - 1) / 7) + 1;
};
const getMonthWeekLabel = (date: Date): string => {
    const monthName = date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    return `${monthName} Week ${getWeekOfMonth(date)}`;
};
const isPrivileged = (role?: string) => role === 'admin' || role === 'org_super_admin' || role === 'super_admin';
const canUseAdminOverride = (role?: string) => role === 'org_super_admin' || role === 'super_admin';
const canAccessOrg = (user: AuthenticatedRequest['user'], orgId: string) =>
    Boolean(user && (user.role === 'super_admin' || user.orgId === orgId));

const getBoardForAccess = async (boardId: string) => first(asRows<BoardAccessRow>((await db.query(
    'SELECT id, org_id, created_by FROM boards WHERE id = ?',
    [boardId]
)).rows));

const getTaskScope = async (taskId: string) => first(asRows<TaskScopeRow>((await db.query(`
    SELECT t.id as task_id, b.id as board_id, b.org_id as org_id, b.created_by as created_by
    FROM tasks t
    JOIN columns c ON c.id = t.column_id
    JOIN boards b ON b.id = c.board_id
    WHERE t.id = ?
`, [taskId])).rows));

const issueRegistrationVerificationToken = (email: string) =>
    jwt.sign(
        {
            type: 'email_verification',
            purpose: EMAIL_VERIFICATION_PURPOSE_REGISTER,
            email: email.trim().toLowerCase()
        },
        JWT_SECRET,
        { expiresIn: EMAIL_VERIFICATION_EXPIRES_HOURS * 60 * 60 }
    );

const validateRegistrationVerificationToken = (token: string, email: string): boolean => {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { type?: string; purpose?: string; email?: string };
        return payload?.type === 'email_verification'
            && payload?.purpose === EMAIL_VERIFICATION_PURPOSE_REGISTER
            && payload?.email === email.trim().toLowerCase();
    } catch {
        return false;
    }
};

export const requestEmailVerificationCode = async (req: Request, res: Response) => {
    const { email, purpose } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPurpose = typeof purpose === 'string' ? purpose.trim().toLowerCase() : EMAIL_VERIFICATION_PURPOSE_REGISTER;

    if (!normalizedEmail || normalizedPurpose !== EMAIL_VERIFICATION_PURPOSE_REGISTER) {
        return res.status(400).json({ error: 'Invalid email verification request' });
    }

    const code = generateSixDigitCode();
    const codeHash = hashVerificationCode(normalizedEmail, code);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000).toISOString();

    try {
        await db.transaction(async (tx: DatabaseAdapter) => {
            await tx.execute(
                'DELETE FROM email_verification_codes WHERE email = ? AND purpose = ?',
                [normalizedEmail, normalizedPurpose]
            );
            await tx.execute(
                'INSERT INTO email_verification_codes (id, email, purpose, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), normalizedEmail, normalizedPurpose, codeHash, expiresAt]
            );
        });

        await sendEmail({
            to: normalizedEmail,
            subject: 'Tasker verification code',
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.5">
                    <h2>Verify your email</h2>
                    <p>Your Tasker verification code is:</p>
                    <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
                    <p>This code expires in ${EMAIL_VERIFICATION_EXPIRES_HOURS} hours.</p>
                </div>
            `
        });

        return res.json({ success: true, expiresInHours: EMAIL_VERIFICATION_EXPIRES_HOURS });
    } catch (error) {
        console.error('Email verification request failed:', error);
        return res.status(500).json({ error: 'Failed to send verification code email' });
    }
};

export const verifyEmailVerificationCode = async (req: Request, res: Response) => {
    const { email, purpose, code } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPurpose = typeof purpose === 'string' ? purpose.trim().toLowerCase() : EMAIL_VERIFICATION_PURPOSE_REGISTER;
    const normalizedCode = typeof code === 'string' ? code.trim() : '';

    if (!normalizedEmail || !normalizedCode || normalizedPurpose !== EMAIL_VERIFICATION_PURPOSE_REGISTER) {
        return res.status(400).json({ error: 'Invalid verification payload' });
    }

    try {
        const row = first(asRows<{ id: string; code_hash: string; expires_at: string }>((await db.query(
            `SELECT id, code_hash, expires_at
             FROM email_verification_codes
             WHERE email = ? AND purpose = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [normalizedEmail, normalizedPurpose]
        )).rows));

        if (!row) return res.status(400).json({ error: 'No verification code found for this email' });
        const expiresAt = new Date(row.expires_at);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
            return res.status(400).json({ error: 'Verification code expired' });
        }

        const expectedHash = hashVerificationCode(normalizedEmail, normalizedCode);
        if (expectedHash !== row.code_hash) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        await db.execute('UPDATE email_verification_codes SET verified_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
        const verificationToken = issueRegistrationVerificationToken(normalizedEmail);
        return res.json({ success: true, verificationToken });
    } catch (error) {
        console.error('Email verification failed:', error);
        return res.status(500).json({ error: 'Failed to verify email code' });
    }
};

export const registerOrg = async (req: Request, res: Response) => {
    console.log('Register Request Body:', req.body);
    const { orgName, userName, username, email, password, skills, location, verificationToken } = req.body;
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!orgName || !userName || !normalizedUsername || !normalizedEmail || !password || !verificationToken) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!validateRegistrationVerificationToken(String(verificationToken), normalizedEmail)) {
        return res.status(400).json({ error: 'Email not verified. Please verify email before registration.' });
    }

    // Check if email exists
    try {
        const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const existingUsername = await db.query('SELECT id FROM users WHERE LOWER(username) = ?', [normalizedUsername]);
        if (existingUsername.rows.length > 0) {
            return res.status(400).json({ error: 'Username already registered' });
        }

        // Check if Org Name exists
        const existingOrg = await db.query('SELECT id FROM organizations WHERE name = ?', [orgName]);
        if (existingOrg.rows.length > 0) {
            return res.status(400).json({ error: 'Organization name already exists. Please choose another.' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const orgId = uuidv4();
        const userId = uuidv4();
        console.log('Starting Transaction for Org:', orgId);

        // Transaction to create Org and User
        await db.transaction(async (tx: DatabaseAdapter) => {
            console.log('Inserting Org...');
            await tx.execute('INSERT INTO organizations (id, name) VALUES (?, ?)', [orgId, orgName]);
            console.log('Inserting User...');
            await tx.execute(
                'INSERT INTO users (id, name, username, email, password_hash, org_id, role, phone_number, skills, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, userName, normalizedUsername, normalizedEmail, hashedPassword, orgId, 'org_super_admin', req.body.phoneNumber || null, skills || null, location || null]
            );
        });
        console.log('Transaction Success');

        const token = jwt.sign({ userId, orgId, role: 'org_super_admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });
        res.json({
            success: true,
            orgId,
            userId,
            token,
            orgName,
            user: { id: userId, name: userName, username: normalizedUsername, email: normalizedEmail, role: 'org_super_admin', skills: skills || null, location: location || null }
        });

    } catch (err: unknown) {
        console.error('Register Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
    }
};

export const registerSuperAdmin = async (req: Request, res: Response) => {
    const { secret, name, email, password } = req.body;
    const providedSecret = typeof secret === 'string' ? secret.trim() : '';
    const validSecret = providedSecret === SUPER_ADMIN_SECRET
        || (!isProduction && providedSecret === DEV_FALLBACK_SUPER_ADMIN_SECRET);
    if (!validSecret) {
        return res.status(403).json({ error: 'Invalid Super Admin Secret' });
    }

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const userId = uuidv4();

        // Ensure "System Governance" Org exists or create unique one for this admin
        // For simplicity, we create a new hidden org for each super admin or reuse one if we had a constant ID.
        // Let's create a new one to satisfy FK constraints.
        const orgId = uuidv4();
        const orgName = "System Governance";

        await db.transaction(async (tx: DatabaseAdapter) => {
            await tx.execute('INSERT INTO organizations (id, name) VALUES (?, ?)', [orgId, orgName]);
            await tx.execute(
                'INSERT INTO users (id, name, email, password_hash, org_id, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, name, email, hashedPassword, orgId, 'super_admin']
            );
        });

        const token = jwt.sign({ userId, orgId, role: 'super_admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });
        res.json({
            success: true,
            orgId,
            token,
            user: { id: userId, name, email, role: 'super_admin' }
        });

    } catch (err: unknown) {
        console.error('Super Admin Register Error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
};

export const getSystemStats = async (_req: Request, res: Response) => {
    try {
        const usersCount = first(asRows<{ count: number }>((await db.query('SELECT COUNT(*) as count FROM users')).rows))?.count ?? 0;
        const orgsCount = first(asRows<{ count: number }>((await db.query('SELECT COUNT(*) as count FROM organizations')).rows))?.count ?? 0;
        const boardsCount = first(asRows<{ count: number }>((await db.query('SELECT COUNT(*) as count FROM boards')).rows))?.count ?? 0;
        const tasksCount = first(asRows<{ count: number }>((await db.query('SELECT COUNT(*) as count FROM tasks')).rows))?.count ?? 0;

        res.json({ users: usersCount, orgs: orgsCount, boards: boardsCount, tasks: tasksCount });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};

export const getAllOrgs = async (_req: Request, res: Response) => {
    try {
        const orgs = (await db.query(`
            SELECT o.id, o.name, o.created_at, COUNT(u.id) as user_count 
            FROM organizations o 
            LEFT JOIN users u ON o.id = u.org_id 
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `)).rows;
        res.json(orgs);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch orgs' });
    }
};

export const getAllUsers = async (_req: Request, res: Response) => {
    try {
        const users = (await db.query(`
            SELECT u.id, u.name, u.email, u.role, u.skills, u.location, o.name as org_name 
            FROM users u 
            LEFT JOIN organizations o ON u.org_id = o.id
            ORDER BY u.id DESC
            LIMIT 100
        `)).rows;
        res.json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const login = async (req: Request, res: Response) => {
    console.log('Login Request:', req.body);
    const { email, identifier, password } = req.body;
    const normalizedIdentifier = typeof identifier === 'string'
        ? identifier.trim().toLowerCase()
        : typeof email === 'string'
            ? email.trim().toLowerCase()
            : '';
    if (!normalizedIdentifier || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Email/username and password are required' });
    }

    try {
        const user = first(asRows<{
            id: string;
            name: string;
            username?: string | null;
            email: string;
            password_hash: string;
            org_id: string;
            role: string;
            last_board_id?: string | null;
            skills?: string | null;
            location?: string | null;
        }>((await db.query(
            'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
            [normalizedIdentifier, normalizedIdentifier]
        )).rows));
        if (!user) return res.status(400).json({ error: 'User not found' });

        if (!user.email || !user.org_id || !user.role || typeof user.password_hash !== 'string') {
            console.error('Login blocked for malformed user row', {
                identifier: normalizedIdentifier,
                userId: user.id
            });
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        let validPassword = false;
        try {
            validPassword = bcrypt.compareSync(password, user.password_hash);
        } catch (error) {
            console.error('Password hash verification failed', {
                identifier: normalizedIdentifier,
                userId: user.id,
                error
            });
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const orgRow = first(asRows<{ name: string }>((await db.query('SELECT name FROM organizations WHERE id = ?', [user.org_id])).rows));
        const token = jwt.sign({ userId: user.id, orgId: user.org_id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });

        res.json({
            success: true,
            token,
            orgId: user.org_id,
            orgName: orgRow ? orgRow.name : 'Unknown',
            user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, lastBoardId: user.last_board_id, skills: user.skills, location: user.location }
        });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
};

export const updateUserLastBoard = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const user = req.user;
    const { boardId } = req.body;

    if (!userId || !boardId || !user) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const board = await getBoardForAccess(boardId);
        if (!board) return res.status(404).json({ error: 'Board not found' });
        if (!canAccessOrg(user, board.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await db.execute('UPDATE users SET last_board_id = ? WHERE id = ?', [boardId, userId]);
        res.json({ success: true, boardId });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update last board' });
    }
};

export const findOrg = async (req: Request, res: Response) => {
    const { name } = req.query; // Use query for GET
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Name is required' });

    try {
        // Return ALL matching orgs to handle duplicates
        const orgs = asRows<{ id: string; name: string }>((await db.query('SELECT id, name FROM organizations WHERE name = ?', [name])).rows);

        if (orgs.length === 0) return res.status(404).json({ error: 'Organization not found' });

        const results = [];
        for (const org of orgs) {
            const boards = (await db.query(`
                SELECT b.id, b.name, b.is_public, b.created_by, u.name as creator_name 
                FROM boards b 
                LEFT JOIN users u ON b.created_by = u.id
                WHERE b.org_id = ?
            `, [org.id])).rows;
            const creator = first((await db.query('SELECT name FROM users WHERE org_id = ? AND role IN (?, ?) ORDER BY CASE WHEN role = ? THEN 0 ELSE 1 END LIMIT 1', [org.id, 'org_super_admin', 'admin', 'org_super_admin'])).rows);
            results.push({ ...org, boards, creatorName: creator?.name || 'Unknown' });
        }

        res.json(results); // Return array
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Lookup failed' });
    }
};

export const registerUser = async (req: Request, res: Response) => {
    const { email, password, userName, username, orgId, joinedBoardIds, phoneNumber, skills, location, verificationToken } = req.body;
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    // Basic Validation
    if (!normalizedEmail || !normalizedUsername || !password || !userName || !orgId || !verificationToken) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!validateRegistrationVerificationToken(String(verificationToken), normalizedEmail)) {
        return res.status(400).json({ error: 'Email not verified. Please verify email before registration.' });
    }

    try {
        // Check email
        const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });
        const existingUsername = await db.query('SELECT id FROM users WHERE LOWER(username) = ?', [normalizedUsername]);
        if (existingUsername.rows.length > 0) return res.status(400).json({ error: 'Username already registered' });

        const hashedPassword = bcrypt.hashSync(password, 10);
        const userId = uuidv4();

        // 1. Create User
        await db.execute(
            'INSERT INTO users (id, name, username, email, password_hash, org_id, role, phone_number, skills, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, userName, normalizedUsername, normalizedEmail, hashedPassword, orgId, 'member', phoneNumber || null, skills || null, location || null]
        );

        // 2. Join selected boards (add to followers) & Notify Owners
        if (Array.isArray(joinedBoardIds) && joinedBoardIds.length > 0) {
            for (const boardId of joinedBoardIds) {
                const board = first(asRows<{ created_by?: string | null; followers?: string | null; name: string }>((await db.query('SELECT created_by, followers, name FROM boards WHERE id = ?', [boardId])).rows));
                if (board) {
                    // Add follower
                    const followers = parseCsvIds(board.followers);
                    if (!followers.includes(userId)) {
                        followers.push(userId);
                        await db.execute('UPDATE boards SET followers = ? WHERE id = ?', [followers.join(','), boardId]);

                        // Notify Board Owner
                        if (board.created_by) {
                            const owner = first(asRows<NotificationRecipient>((await db.query('SELECT id, email, phone_number, name FROM users WHERE id = ?', [board.created_by])).rows));
                            if (owner) {
                                await sendNotification(owner, `New Member: ${userName} joined your board "${board.name}"`);
                            }
                        }
                    }
                }
            }
        }

        const token = jwt.sign({ userId, orgId, role: 'member' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });
        const orgRow = first((await db.query('SELECT name FROM organizations WHERE id = ?', [orgId])).rows);

        res.json({
            success: true,
            orgId,
            userId,
            token,
            orgName: orgRow ? orgRow.name : 'Unknown Org',
            user: { id: userId, name: userName, username: normalizedUsername, email: normalizedEmail, role: 'member', skills: skills || null, location: location || null }
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

// --- Mock Notification Service ---
const sendNotification = async (user: { id: string, email: string, phone_number?: string | null, name: string }, message: string, type: string = 'info') => {
    console.log(`[NOTIFICATION] To: ${user.name} (${user.email}) | Type: ${type} | Msg: ${message}`);

    // 1. Persist to Database
    try {
        const notifId = uuidv4();
        await db.execute(
            'INSERT INTO notifications (id, user_id, message, type) VALUES (?, ?, ?, ?)',
            [notifId, user.id, message, type]
        );
    } catch (e) {
        console.error("Failed to persist notification:", e);
    }

    // 2. Email Simulation
    // await emailService.send(user.email, message);

    if (user.phone_number) {
        console.log(`[SMS] To: ${user.phone_number} | Msg: ${message}`);
        // SMS Simulation
        // await smsService.send(user.phone_number, message);
    } else {
        console.log(`[SMS] Skipped (No Phone Number) for ${user.name}`);
    }
};

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const notifications = (await db.query(`
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `, [userId])).rows;
        res.json(notifications);
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const id = String(req.params.id);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        if (id === 'all') {
            await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
        } else {
            await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
        }
        res.json({ success: true });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
};

export const createBoard = async (req: AuthenticatedRequest, res: Response) => {
    // Allow all authenticated users to create boards
    // if (req.user?.role !== 'admin') {
    //     return res.status(403).json({ error: 'Only admins can create boards' });
    // }

    const { name, orgId, isPublic } = req.body;
    const userId = req.user?.userId;
    const user = req.user;
    const id = uuidv4();
    const requestedName = typeof name === 'string' ? name.trim() : '';
    const finalName = requestedName || getMonthWeekLabel(new Date());

    try {
        if (!user || !canAccessOrg(user, orgId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Auto-follow the creator
        const followers = userId ? userId : '';
        await db.execute('INSERT INTO boards (id, name, org_id, created_by, followers, is_public) VALUES (?, ?, ?, ?, ?, ?)',
            [id, finalName, orgId, userId || null, followers, isPublic ? 1 : 0]);

        // Create default columns
        const cols = [
            { id: uuidv4(), title: 'To Do', idx: 0 },
            { id: uuidv4(), title: 'In Progress', idx: 1 },
            { id: uuidv4(), title: 'Done', idx: 2 }
        ];

        for (const col of cols) {
            await db.execute(
                'INSERT INTO columns (id, board_id, title, order_index) VALUES (?, ?, ?, ?)',
                [col.id, id, col.title, col.idx]
            );
        }

        const boardRow = first((await db.query(
            'SELECT id, name, org_id, created_by, followers, is_public, created_at FROM boards WHERE id = ?',
            [id]
        )).rows);
        if (boardRow) {
            return res.json({
                id: boardRow.id,
                name: boardRow.name,
                orgId: boardRow.org_id,
                created_by: boardRow.created_by,
                followers: boardRow.followers,
                is_public: boardRow.is_public,
                created_at: boardRow.created_at
            });
        }
        return res.json({ id, name: finalName, orgId, created_by: userId, followers, is_public: isPublic ? 1 : 0 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const createTask = async (req: AuthenticatedRequest, res: Response) => {
    const {
        columnId, title, description, assignedTo,
        urgency, dueDate, weatherSensitive, fundingNeeded,
        peopleRequired, skills,
        weatherIndex, fundingFactor, skillAvailability,
        projectDuration, projectLocation, weatherCode,
        adminOverrideUrgency, adminOverridePriority
    } = req.body;
    const id = uuidv4();
    const score = 0;

    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const columnScope = first(asRows<{ column_id: string; board_id: string; org_id: string }>((await db.query(`
            SELECT c.id as column_id, b.id as board_id, b.org_id as org_id
            FROM columns c
            JOIN boards b ON b.id = c.board_id
            WHERE c.id = ?
        `, [columnId])).rows));
        if (!columnScope) return res.status(404).json({ error: 'Column not found' });
        if (!canAccessOrg(req.user, columnScope.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (assignedTo) {
            const assignee = first((await db.query(
                'SELECT id FROM users WHERE id = ? AND org_id = ?',
                [assignedTo, columnScope.org_id]
            )).rows);
            if (!assignee) {
                return res.status(400).json({ error: 'Assigned user must belong to the same organization' });
            }
        }

        const normalizedOverrideUrgency = canUseAdminOverride(req.user.role) && adminOverrideUrgency !== undefined && adminOverrideUrgency !== null
            ? Math.max(0, Math.min(100, Number(adminOverrideUrgency)))
            : null;
        const normalizedOverridePriority = canUseAdminOverride(req.user.role) && adminOverridePriority !== undefined && adminOverridePriority !== null
            ? Math.max(0, Math.min(100, Number(adminOverridePriority)))
            : 0;

        await db.execute(`
            INSERT INTO tasks (
                id, column_id, title, description, assigned_to, 
                urgency, due_date, weather_sensitive, funding_needed, 
                people_required, skills,
                weather_index, funding_factor, skill_availability,
                admin_override_urgency, admin_override_priority,
                priority_score, project_duration, project_location,
                weather_code, interested_users
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, columnId, title, description, assignedTo,
            urgency, dueDate, weatherSensitive ? 1 : 0, fundingNeeded,
            peopleRequired || 1, skills || '',
            weatherIndex || 0, fundingFactor || 0, skillAvailability || 50,
            normalizedOverrideUrgency, normalizedOverridePriority,
            score, projectDuration || '', projectLocation || '',
            weatherCode !== undefined ? weatherCode : null,
            '' // Init interested_users
        ]);

        res.json({ id, title, priority_score: score });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getBoard = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const { includeArchived } = req.query;

    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const board = first(asRows<{ org_id: string } & Record<string, unknown>>((await db.query('SELECT * FROM boards WHERE id = ?', [id])).rows));
        if (!board) return res.status(404).json({ error: 'Board not found' });
        if (!canAccessOrg(req.user, board.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const columns = asRows<{ id: string } & Record<string, unknown>>((await db.query('SELECT * FROM columns WHERE board_id = ? ORDER BY order_index', [id])).rows);

        const columnsWithTasks: { id: string; tasks: Record<string, unknown>[] }[] = [];
        for (const col of columns) {
            const query = includeArchived === 'true'
                ? 'SELECT * FROM tasks WHERE column_id = ? ORDER BY priority_score DESC'
                : 'SELECT * FROM tasks WHERE column_id = ? AND (archived = 0 OR archived IS NULL) ORDER BY priority_score DESC';

            const tasks = asRows<Record<string, unknown>>((await db.query(query, [col.id])).rows);
            columnsWithTasks.push({ ...col, tasks });
        }

        res.json({ ...board, columns: columnsWithTasks });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const moveTask = async (req: AuthenticatedRequest, res: Response) => {
    const { taskId, targetColumnId } = req.body;
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const taskScope = await getTaskScope(taskId);
        if (!taskScope) return res.status(404).json({ error: 'Task not found' });
        if (!canAccessOrg(req.user, taskScope.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const taskMeta = first(asRows<{ interested_users?: string | null }>((await db.query(`
            SELECT t.interested_users
            FROM tasks t
            WHERE t.id = ?
        `, [taskId])).rows));
        if (!taskMeta) return res.status(404).json({ error: 'Task not found' });

        const isTaskInterested = parseCsvIds(taskMeta.interested_users).includes(req.user.userId);
        const privilegedUser = isPrivileged(req.user.role);

        if (!privilegedUser && !isTaskInterested) {
            return res.status(403).json({ error: 'Only task admins (interested members) or org admins can move this task' });
        }

        const targetScope = first(asRows<{ column_id: string; org_id: string }>((await db.query(`
            SELECT c.id as column_id, b.org_id as org_id
            FROM columns c
            JOIN boards b ON b.id = c.board_id
            WHERE c.id = ?
        `, [targetColumnId])).rows));
        if (!targetScope) return res.status(404).json({ error: 'Target column not found' });
        if (!canAccessOrg(req.user, targetScope.org_id) || targetScope.org_id !== taskScope.org_id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const targetColumn = first(asRows<{ title: string }>((await db.query('SELECT title FROM columns WHERE id = ?', [targetColumnId])).rows));
        const completedAt = targetColumn && isDoneColumnTitle(targetColumn.title) ? new Date().toISOString() : null;
        await db.execute('UPDATE tasks SET column_id = ?, completed_at = ? WHERE id = ?', [targetColumnId, completedAt, taskId]);
        res.json({ success: true, taskId, targetColumnId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const {
        title, description, urgency, dueDate,
        weatherSensitive, fundingNeeded, peopleRequired, skills,
        weather_index, funding_factor, skill_availability,
        archived, projectDuration, projectLocation, weatherCode,
        interested_users, assignedTo, adminOverrideUrgency, adminOverridePriority
    } = req.body;

    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const taskScope = await getTaskScope(id);
        if (!taskScope) return res.status(404).json({ error: 'Task not found' });
        if (!canAccessOrg(req.user, taskScope.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const taskAccessRow = first(asRows<{
            assigned_to?: string | null;
            interested_users?: string | null;
            admin_override_urgency?: number | null;
            admin_override_priority?: number | null;
        }>((await db.query(
            'SELECT assigned_to, interested_users, admin_override_urgency, admin_override_priority FROM tasks WHERE id = ?',
            [id]
        )).rows));
        if (!taskAccessRow) return res.status(404).json({ error: 'Task not found' });
        const interestedIds = parseCsvIds(taskAccessRow.interested_users);
        const canMutateTask = isPrivileged(req.user.role)
            || taskScope.created_by === req.user.userId
            || taskAccessRow.assigned_to === req.user.userId
            || interestedIds.includes(req.user.userId);
        if (!canMutateTask) {
            return res.status(403).json({ error: 'Only task members or admins can update this task' });
        }

        const updates: string[] = [];
        const params: (string | number | boolean | null)[] = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (urgency !== undefined) {
            updates.push('urgency = ?');
            params.push(urgency);
        }
        if (dueDate !== undefined) {
            updates.push('due_date = ?');
            params.push(dueDate);
        }
        if (weatherSensitive !== undefined) {
            updates.push('weather_sensitive = ?');
            params.push(weatherSensitive ? 1 : 0);
        }
        if (fundingNeeded !== undefined) {
            updates.push('funding_needed = ?');
            params.push(fundingNeeded);
        }
        if (peopleRequired !== undefined) {
            updates.push('people_required = ?');
            params.push(peopleRequired);
        }
        if (skills !== undefined) {
            updates.push('skills = ?');
            params.push(skills);
        }
        if (weather_index !== undefined) {
            updates.push('weather_index = ?');
            params.push(weather_index);
        }
        if (funding_factor !== undefined) {
            updates.push('funding_factor = ?');
            params.push(funding_factor);
        }
        if (skill_availability !== undefined) {
            updates.push('skill_availability = ?');
            params.push(skill_availability);
        }
        if (archived !== undefined) {
            updates.push('archived = ?');
            params.push(archived ? 1 : 0);
        }
        if (projectDuration !== undefined) {
            updates.push('project_duration = ?');
            params.push(projectDuration);
        }
        if (projectLocation !== undefined) {
            updates.push('project_location = ?');
            params.push(projectLocation);
        }
        if (weatherCode !== undefined) {
            updates.push('weather_code = ?');
            params.push(weatherCode);
        }
        if (interested_users !== undefined) {
            updates.push('interested_users = ?');
            params.push(interested_users);
        }
        if (assignedTo !== undefined) {
            if (assignedTo) {
                const assignee = first((await db.query(
                    'SELECT id FROM users WHERE id = ? AND org_id = ?',
                    [assignedTo, taskScope.org_id]
                )).rows);
                if (!assignee) {
                    return res.status(400).json({ error: 'Assigned user must belong to the same organization' });
                }
            }
            updates.push('assigned_to = ?');
            params.push(assignedTo || null);
        }
        let normalizedOverrideUrgency: number | null | undefined = undefined;
        let normalizedOverridePriority: number | undefined = undefined;

        if (adminOverrideUrgency !== undefined) {
            if (!canUseAdminOverride(req.user.role)) {
                return res.status(403).json({ error: 'Only org super admins can override task urgency' });
            }
            normalizedOverrideUrgency = adminOverrideUrgency === null || adminOverrideUrgency === ''
                ? null
                : Math.max(0, Math.min(100, Number(adminOverrideUrgency)));
            updates.push('admin_override_urgency = ?');
            params.push(normalizedOverrideUrgency);
        }
        if (adminOverridePriority !== undefined) {
            if (!canUseAdminOverride(req.user.role)) {
                return res.status(403).json({ error: 'Only org super admins can override task priority' });
            }
            normalizedOverridePriority = Math.max(0, Math.min(100, Number(adminOverridePriority)));
            updates.push('admin_override_priority = ?');
            params.push(normalizedOverridePriority);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No task fields provided for update' });
        }

        params.push(id);
        await db.execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, params);

        const previousOverrideUrgency = taskAccessRow.admin_override_urgency === null || taskAccessRow.admin_override_urgency === undefined
            ? null
            : Number(taskAccessRow.admin_override_urgency);
        const previousOverridePriority = Number(taskAccessRow.admin_override_priority || 0);
        const nextOverrideUrgency = normalizedOverrideUrgency !== undefined
            ? normalizedOverrideUrgency
            : previousOverrideUrgency;
        const nextOverridePriority = normalizedOverridePriority !== undefined
            ? normalizedOverridePriority
            : previousOverridePriority;
        const overrideChanged = nextOverrideUrgency !== previousOverrideUrgency
            || nextOverridePriority !== previousOverridePriority;

        if (canUseAdminOverride(req.user.role) && overrideChanged) {
            await db.execute(
                `INSERT INTO task_override_audit (
                    id, task_id, org_id,
                    previous_admin_override_urgency, new_admin_override_urgency,
                    previous_admin_override_priority, new_admin_override_priority,
                    changed_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    uuidv4(),
                    id,
                    taskScope.org_id,
                    previousOverrideUrgency,
                    nextOverrideUrgency,
                    previousOverridePriority,
                    nextOverridePriority,
                    req.user.userId
                ]
            );
        }

        res.json({ success: true, id });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getTaskOverrideHistory = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 20;

    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const taskScope = await getTaskScope(id);
        if (!taskScope) return res.status(404).json({ error: 'Task not found' });
        if (!canAccessOrg(req.user, taskScope.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!canUseAdminOverride(req.user.role)) {
            return res.status(403).json({ error: 'Only org super admins can view override history' });
        }

        const history = (await db.query(
            `SELECT
                a.id,
                a.task_id,
                a.previous_admin_override_urgency,
                a.new_admin_override_urgency,
                a.previous_admin_override_priority,
                a.new_admin_override_priority,
                a.changed_by,
                a.changed_at,
                u.name AS changed_by_name
             FROM task_override_audit a
             LEFT JOIN users u ON u.id = a.changed_by
             WHERE a.task_id = ? AND a.org_id = ?
             ORDER BY a.changed_at DESC
             LIMIT ?`,
            [id, taskScope.org_id, limit]
        )).rows;

        res.json(history);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const taskScope = await getTaskScope(id);
        if (!taskScope) return res.status(404).json({ error: 'Task not found' });
        if (!canAccessOrg(req.user, taskScope.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const taskAccessRow = first(asRows<{ assigned_to?: string | null; interested_users?: string | null }>((await db.query(
            'SELECT assigned_to, interested_users FROM tasks WHERE id = ?',
            [id]
        )).rows));
        if (!taskAccessRow) return res.status(404).json({ error: 'Task not found' });
        const interestedIds = parseCsvIds(taskAccessRow.interested_users);
        const canDeleteTask = isPrivileged(req.user.role)
            || taskScope.created_by === req.user.userId
            || taskAccessRow.assigned_to === req.user.userId
            || interestedIds.includes(req.user.userId);
        if (!canDeleteTask) {
            return res.status(403).json({ error: 'Only task members or admins can delete this task' });
        }
        await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ success: true, id });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getBoards = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!canAccessOrg(req.user, orgId)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // Only show non-archived boards in main list? Or let frontend filter?
        // User asked for "Archive page" implies we might want to see them somewhere.
        // But for main list, filter out archived.
        // But for main list, filter out archived.
        // But for main list, filter out archived.
        const result = await db.query(`
            SELECT b.id, b.name, b.created_at, b.archived, b.created_by, b.followers, b.is_public, u.name as creator_name
            FROM boards b
            LEFT JOIN users u ON b.created_by = u.id
            WHERE b.org_id = ?
            ORDER BY b.created_at DESC
        `, [orgId]);
        res.json(result.rows);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getReportingOverview = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const weekStartInput = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.role !== 'super_admin' && user.orgId !== orgId) {
        return res.status(403).json({ error: 'Access denied for this organization' });
    }

    try {
        const weekStart = startOfWeek(weekStartInput);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

        const users = asRows<{ id: string; name: string }>((await db.query('SELECT id, name FROM users WHERE org_id = ?', [orgId])).rows);
        const userNameById = new Map<string, string>(users.map((row) => [row.id, row.name]));

        const orgBoards = asRows<ReportingBoardRow>((await db.query(`
            SELECT b.id, b.name, b.created_at, b.created_by, b.followers, b.is_public, b.archived, u.name as creator_name
            FROM boards b
            LEFT JOIN users u ON b.created_by = u.id
            WHERE b.org_id = ?
            ORDER BY b.created_at DESC
        `, [orgId])).rows);

        const publicBoards = (await db.query(`
            SELECT b.id, b.name, b.created_at, b.org_id, o.name as org_name, u.name as creator_name
            FROM boards b
            LEFT JOIN organizations o ON o.id = b.org_id
            LEFT JOIN users u ON u.id = b.created_by
            WHERE b.is_public = 1
            ORDER BY b.created_at DESC
            LIMIT 100
        `)).rows;

        const boardOverview: BoardSummary[] = [];
        const activeProjects: BoardSummary[] = [];
        const pendingRanking: RankedBoardSummary[] = [];
        const completedProjectsWeek: CompletedBoardSummary[] = [];
        const weeklyTasks: WeeklyTaskSummary[] = [];

        for (const board of orgBoards) {
            const boardTasks = asRows<ReportingTaskRow>((await db.query(`
                SELECT t.*, c.title as column_title
                FROM tasks t
                JOIN columns c ON c.id = t.column_id
                WHERE c.board_id = ?
            `, [board.id])).rows);

            const doneTasks = boardTasks.filter((task) => isDoneColumnTitle(task.column_title));
            const todoTasks = boardTasks.filter((task) => isTodoColumnTitle(task.column_title));
            const inProgressTasks = boardTasks.filter((task) => !isDoneColumnTitle(task.column_title) && !isTodoColumnTitle(task.column_title));
            const completionRate = boardTasks.length > 0 ? Math.round((doneTasks.length / boardTasks.length) * 100) : 0;

            const participantIds = new Set<string>();
            parseCsvIds(board.followers).forEach((id) => participantIds.add(id));
            for (const task of boardTasks) {
                if (task.assigned_to) participantIds.add(task.assigned_to);
                parseCsvIds(task.interested_users).forEach((id) => participantIds.add(id));
            }
            const participantNames = Array.from(participantIds)
                .map((id) => userNameById.get(id))
                .filter(Boolean) as string[];

            const locations = Array.from(new Set(
                boardTasks
                    .map((task) => (task.project_location || '').trim())
                    .filter(Boolean)
            ));

            const priorityValues = boardTasks.map((task) => Number(task.priority_score) || Number(task.urgency) || 0);
            const averagePriority = priorityValues.length > 0
                ? Math.round(priorityValues.reduce((sum, value) => sum + value, 0) / priorityValues.length)
                : 0;

            const summary: BoardSummary = {
                id: board.id,
                name: board.name,
                creator_name: board.creator_name || 'Unknown',
                visibility: board.is_public ? 'public' : 'private',
                archived: Boolean(board.archived),
                total_tasks: boardTasks.length,
                todo_tasks: todoTasks.length,
                in_progress_tasks: inProgressTasks.length,
                done_tasks: doneTasks.length,
                completion_rate: completionRate,
                average_priority: averagePriority,
                participants: participantNames,
                locations
            };
            boardOverview.push(summary);

            const isNotStarted = boardTasks.length > 0 && todoTasks.length === boardTasks.length;
            const isActive = boardTasks.length > 0 && doneTasks.length < boardTasks.length && inProgressTasks.length > 0;
            const isCompleted = boardTasks.length > 0 && doneTasks.length === boardTasks.length;

            if (isActive) {
                activeProjects.push(summary);
            }

            if (isNotStarted) {
                const highUrgencyCount = boardTasks.filter((task) => Number(task.urgency) >= 80).length;
                const dueSoonCount = boardTasks.filter((task) => {
                    if (!task.due_date) return false;
                    const due = new Date(task.due_date);
                    return !Number.isNaN(due.getTime()) && due >= weekStart && due < weekEnd;
                }).length;
                const rankingScore = (averagePriority * 2) + (highUrgencyCount * 15) + (dueSoonCount * 10) + boardTasks.length;
                const explanation = [
                    `Avg priority ${averagePriority}`,
                    `${highUrgencyCount} high-urgency tasks`,
                    `${dueSoonCount} tasks due this week`
                ].join(', ');

                pendingRanking.push({
                    ...summary,
                    ranking_score: rankingScore,
                    priority_explanation: explanation
                });
            }

            if (isCompleted) {
                const completionDates = doneTasks
                    .map((task) => task.completed_at ? new Date(task.completed_at) : null)
                    .filter((value: Date | null): value is Date => Boolean(value) && !Number.isNaN(value!.getTime()));

                if (completionDates.length > 0) {
                    const latestCompletion = completionDates.reduce((latest, current) => current > latest ? current : latest);
                    if (latestCompletion >= weekStart && latestCompletion < weekEnd) {
                        completedProjectsWeek.push({
                            ...summary,
                            completed_on: isoDate(latestCompletion)
                        });
                    }
                }
            }

            for (const task of boardTasks) {
                const dueDate = task.due_date ? new Date(task.due_date) : null;
                const completedAt = task.completed_at ? new Date(task.completed_at) : null;
                const inDueWeek = Boolean(dueDate && !Number.isNaN(dueDate.getTime()) && dueDate >= weekStart && dueDate < weekEnd);
                const inCompletedWeek = Boolean(completedAt && !Number.isNaN(completedAt.getTime()) && completedAt >= weekStart && completedAt < weekEnd);

                if (!inDueWeek && !inCompletedWeek) continue;

                const taskParticipantIds = new Set<string>();
                if (task.assigned_to) taskParticipantIds.add(task.assigned_to);
                parseCsvIds(task.interested_users).forEach((id) => taskParticipantIds.add(id));
                const taskParticipants = Array.from(taskParticipantIds)
                    .map((id) => userNameById.get(id))
                    .filter(Boolean) as string[];

                let status: WeeklyTaskSummary['status'] = 'in_progress';
                if (isDoneColumnTitle(task.column_title)) status = 'completed';
                else if (isTodoColumnTitle(task.column_title)) status = 'not_started';

                weeklyTasks.push({
                    id: task.id,
                    board_id: board.id,
                    board_name: board.name,
                    title: task.title,
                    status,
                    due_date: task.due_date ? isoDate(new Date(task.due_date)) : null,
                    completed_at: task.completed_at ? isoDate(new Date(task.completed_at)) : null,
                    location: task.project_location || null,
                    participants: taskParticipants,
                    priority_score: Number(task.priority_score) || Number(task.urgency) || 0
                });
            }
        }

        const notStartedProjects = pendingRanking
            .sort((a, b) => b.ranking_score - a.ranking_score)
            .map((project, index) => ({
                ...project,
                rank: index + 1
            }));

        weeklyTasks.sort((a, b) => b.priority_score - a.priority_score);

        res.json({
            orgId,
            week_start: isoDate(weekStart),
            week_end: isoDate(weekEnd),
            active_projects: activeProjects,
            not_started_projects: notStartedProjects,
            completed_projects_week: completedProjectsWeek,
            weekly_tasks: weeklyTasks,
            board_overview: boardOverview,
            public_boards: publicBoards
        });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const emailReportingExport = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const user = req.user;
    const { to, subject, weekStart, format, fileName, fileBase64 } = req.body as {
        to?: string | string[];
        subject?: string;
        weekStart?: string;
        format?: 'pdf' | 'doc';
        fileName?: string;
        fileBase64?: string;
    };

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canAccessOrg(user, orgId)) return res.status(403).json({ error: 'Forbidden' });

    const recipientsRaw = Array.isArray(to)
        ? to
        : (typeof to === 'string' ? to.split(',') : []);
    const recipients = recipientsRaw.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!recipients.length || recipients.length > 20 || recipients.some((email) => !emailRegex.test(email))) {
        return res.status(400).json({ error: 'Provide 1-20 valid recipient email addresses' });
    }
    if (!fileBase64 || typeof fileBase64 !== 'string') {
        return res.status(400).json({ error: 'Missing report attachment' });
    }
    const normalizedFormat = format === 'pdf' ? 'pdf' : 'doc';
    const bytes = Buffer.from(fileBase64, 'base64');
    if (bytes.byteLength > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Attachment exceeds 10MB limit' });
    }

    try {
        const org = first((await db.query('SELECT name FROM organizations WHERE id = ?', [orgId])).rows);
        const orgDisplay = org?.name || 'Organization';
        const subjectLine = (typeof subject === 'string' && subject.trim())
            ? subject.trim()
            : `Tasker report - ${orgDisplay} - ${weekStart || 'current week'}`;

        await sendEmail({
            to: recipients,
            subject: subjectLine,
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.5">
                    <h2>Tasker Reporting Export</h2>
                    <p>Please find the attached report.</p>
                    <p><strong>Organization:</strong> ${orgDisplay}</p>
                    <p><strong>Week Start:</strong> ${weekStart || 'N/A'}</p>
                </div>
            `,
            attachments: [{
                filename: fileName || `tasker-report.${normalizedFormat}`,
                contentBase64: fileBase64,
                contentType: normalizedFormat === 'pdf' ? 'application/pdf' : 'application/msword'
            }]
        });

        res.json({ success: true, recipients: recipients.length });
    } catch (err: unknown) {
        console.error('Failed to email reporting export', err);
        res.status(500).json({ error: 'Failed to email report' });
    }
};

export const elevateToSuperAdmin = async (req: Request, res: Response) => {
    const { secret, email, password } = req.body;
    const providedSecret = typeof secret === 'string' ? secret.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const validSecret = providedSecret === SUPER_ADMIN_SECRET
        || (!isProduction && providedSecret === DEV_FALLBACK_SUPER_ADMIN_SECRET);

    if (!validSecret) {
        return res.status(403).json({ error: 'Invalid Super Admin Secret' });
    }
    if (!normalizedEmail || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const user = first(asRows<{ id: string; name: string; username?: string | null; email: string; org_id: string; role: string; password_hash: string }>((await db.query('SELECT * FROM users WHERE LOWER(email) = ?', [normalizedEmail])).rows));
        if (!user) return res.status(404).json({ error: 'User not found' });

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) return res.status(403).json({ error: 'Invalid credentials' });

        if (user.role !== 'super_admin') {
            await db.execute('UPDATE users SET role = ? WHERE id = ?', ['super_admin', user.id]);
        }

        const token = jwt.sign({ userId: user.id, orgId: user.org_id, role: 'super_admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });
        return res.json({
            success: true,
            orgId: user.org_id,
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: 'super_admin'
            }
        });
    } catch (err: unknown) {
        console.error('Super Admin Elevation Error:', err);
        return res.status(500).json({ error: 'Failed to elevate user to super admin' });
    }
};

export const deElevateSuperAdmin = async (req: AuthenticatedRequest, res: Response) => {
    const requester = req.user;
    const { password, targetRole } = req.body as { password?: string; targetRole?: string };

    if (!requester || requester.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied: Super Admin only' });
    }

    const allowedTargetRoles = new Set(['org_super_admin', 'admin', 'member']);
    const normalizedTargetRole = typeof targetRole === 'string' ? targetRole.trim() : 'org_super_admin';
    if (!allowedTargetRoles.has(normalizedTargetRole)) {
        return res.status(400).json({ error: 'Invalid target role' });
    }
    if (!password || !password.trim()) {
        return res.status(400).json({ error: 'Password is required to de-elevate' });
    }

    try {
        const user = first(asRows<{ id: string; name: string; username?: string | null; email: string; org_id: string; role: string; password_hash: string }>((await db.query(
            'SELECT id, name, username, email, org_id, role, password_hash FROM users WHERE id = ?',
            [requester.userId]
        )).rows));
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role !== 'super_admin') {
            return res.status(400).json({ error: 'User is not currently a super admin' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) return res.status(403).json({ error: 'Invalid credentials' });

        const superAdminCountRow = first((await db.query(
            "SELECT COUNT(*) as count FROM users WHERE role = 'super_admin'"
        )).rows);
        const superAdminCount = Number(superAdminCountRow?.count || 0);
        if (superAdminCount <= 1) {
            return res.status(400).json({ error: 'Cannot de-elevate the last super admin' });
        }

        await db.execute('UPDATE users SET role = ? WHERE id = ?', [normalizedTargetRole, user.id]);

        const token = jwt.sign(
            { userId: user.id, orgId: user.org_id, role: normalizedTargetRole },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN_SECONDS }
        );
        return res.json({
            success: true,
            orgId: user.org_id,
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: normalizedTargetRole
            }
        });
    } catch (err: unknown) {
        console.error('Super Admin De-elevation Error:', err);
        return res.status(500).json({ error: 'Failed to de-elevate super admin' });
    }
};

export const searchOrgs = async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const requestedLimit = Number(req.query.limit || 8);
    const limit = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, requestedLimit)) : 8;

    if (!q) return res.json([]);

    try {
        const orgs = (await db.query(
            'SELECT id, name FROM organizations WHERE LOWER(name) LIKE ? ORDER BY name ASC LIMIT ?',
            [`%${q}%`, limit]
        )).rows;

        const results = [];
        for (const org of orgs) {
            const boards = (await db.query(`
                SELECT b.id, b.name, b.is_public, b.created_by, u.name as creator_name
                FROM boards b
                LEFT JOIN users u ON b.created_by = u.id
                WHERE b.org_id = ?
            `, [org.id])).rows;
            const creator = first((await db.query(
                'SELECT name FROM users WHERE org_id = ? AND role IN (?, ?) ORDER BY CASE WHEN role = ? THEN 0 ELSE 1 END LIMIT 1',
                [org.id, 'org_super_admin', 'admin', 'org_super_admin']
            )).rows);
            results.push({ ...org, boards, creatorName: creator?.name || 'Unknown' });
        }

        res.json(results);
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Organization search failed' });
    }
};

export const getOrgMembersOverview = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const weekStartInput = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canAccessOrg(user, orgId) || !isPrivileged(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        const weekStart = startOfWeek(weekStartInput);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

        const members = asRows<MemberOverviewRow>((await db.query(`
            SELECT id, name, email, role, phone_number, skills, location, last_board_id
            FROM users
            WHERE org_id = ?
            ORDER BY CASE
                WHEN role = 'org_super_admin' THEN 0
                WHEN role = 'admin' THEN 1
                WHEN role = 'member' THEN 2
                ELSE 3
            END, name ASC
        `, [orgId])).rows);

        const memberMap = new Map<string, MemberOverview>();
        for (const member of members) {
            memberMap.set(member.id, {
                ...member,
                followed_boards: [],
                assigned_tasks_week: [],
                interested_tasks_week: [],
                active_tasks_week: [],
                current_tasks_now: [],
                recurring_duties: [],
                recurring_duties_active_now: []
            });
        }
        const dutyByUser = await fetchRecurringDutiesByUserIds(members.map((member) => member.id));
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const nowDay = now.getDay();
        for (const member of members) {
            const target = memberMap.get(member.id);
            if (!target) continue;
            const duties = dutyByUser.get(member.id) || [];
            target.recurring_duties = duties;
            target.recurring_duties_active_now = duties.filter((duty) => {
                const [startHour, startMinute] = duty.startTime.split(':').map(Number);
                const [endHour, endMinute] = duty.endTime.split(':').map(Number);
                const startTotal = (startHour * 60) + startMinute;
                const endTotal = (endHour * 60) + endMinute;
                const dayMatch = duty.cadence === 'daily' || Number(duty.dayOfWeek) === nowDay;
                const inWindow = nowMinutes >= startTotal && nowMinutes <= endTotal;
                return dayMatch && inWindow;
            });
        }

        const boards = asRows<BoardFollowerRow>((await db.query(`
            SELECT id, name, followers
            FROM boards
            WHERE org_id = ?
        `, [orgId])).rows);
        for (const board of boards) {
            const followers = parseCsvIds(board.followers);
            for (const followerId of followers) {
                const member = memberMap.get(followerId);
                if (member) {
                    member.followed_boards.push({ id: board.id, name: board.name });
                }
            }
        }

        const tasks = asRows<MemberTaskRow>((await db.query(`
            SELECT t.id, t.title, t.assigned_to, t.interested_users, t.due_date, t.completed_at, t.project_location, c.title as column_title, b.name as board_name
            FROM tasks t
            JOIN columns c ON c.id = t.column_id
            JOIN boards b ON b.id = c.board_id
            WHERE b.org_id = ?
        `, [orgId])).rows);

        for (const task of tasks) {
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const completedAt = task.completed_at ? new Date(task.completed_at) : null;
            const inDueWeek = Boolean(dueDate && !Number.isNaN(dueDate.getTime()) && dueDate >= weekStart && dueDate < weekEnd);
            const inCompletedWeek = Boolean(completedAt && !Number.isNaN(completedAt.getTime()) && completedAt >= weekStart && completedAt < weekEnd);

            let status: MemberTaskSummary['status'] = 'in_progress';
            if (isDoneColumnTitle(task.column_title)) status = 'completed';
            else if (isTodoColumnTitle(task.column_title)) status = 'not_started';
            const isActiveStatus = status === 'in_progress' || status === 'not_started';
            const includeInWeek = inDueWeek || inCompletedWeek || isActiveStatus;
            if (!includeInWeek) continue;

            const taskSummary: MemberTaskSummary = {
                id: task.id,
                title: task.title,
                board_name: task.board_name,
                status,
                location: task.project_location || null,
                due_date: task.due_date ? isoDate(new Date(task.due_date)) : null,
                completed_at: task.completed_at ? isoDate(new Date(task.completed_at)) : null
            };

            if (task.assigned_to && memberMap.has(task.assigned_to)) {
                const member = memberMap.get(task.assigned_to);
                if (!member) continue;
                member.assigned_tasks_week.push(taskSummary);
                member.active_tasks_week.push(taskSummary);
                if (isActiveStatus && !member.current_tasks_now.some((entry) => entry.id === taskSummary.id)) {
                    member.current_tasks_now.push(taskSummary);
                }
            }

            const interestedUsers = parseCsvIds(task.interested_users);
            for (const memberId of interestedUsers) {
                if (memberMap.has(memberId)) {
                    const member = memberMap.get(memberId);
                    if (!member) continue;
                    member.interested_tasks_week.push(taskSummary);
                    if (!member.active_tasks_week.some((entry) => entry.id === taskSummary.id)) {
                        member.active_tasks_week.push(taskSummary);
                    }
                    if (isActiveStatus && !member.current_tasks_now.some((entry) => entry.id === taskSummary.id)) {
                        member.current_tasks_now.push(taskSummary);
                    }
                }
            }
        }

        res.json({
            orgId,
            week_start: isoDate(weekStart),
            week_end: isoDate(weekEnd),
            members: Array.from(memberMap.values())
        });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getWeeklyObjective = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const month = typeof req.query.month === 'string' ? req.query.month : '';
    const week = Number(req.query.week);
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canAccessOrg(user, orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (!month || Number.isNaN(week) || week < 1 || week > 4) {
        return res.status(400).json({ error: 'Invalid month/week query' });
    }

    try {
        const objective = first((await db.query(
            `SELECT w.objective_text, w.updated_at, w.updated_by, u.name as updated_by_name
             FROM weekly_objectives w
             LEFT JOIN users u ON u.id = w.updated_by
             WHERE w.org_id = ? AND w.month_key = ? AND w.week_number = ?`,
            [orgId, month, week]
        )).rows);
        res.json({
            orgId,
            month,
            week,
            objective: objective?.objective_text || '',
            updated_at: objective?.updated_at || null,
            updated_by: objective?.updated_by || null,
            updated_by_name: objective?.updated_by_name || null
        });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getWeeklyObjectiveHistory = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const month = typeof req.query.month === 'string' ? req.query.month : '';
    const week = Number(req.query.week);
    const user = req.user;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canAccessOrg(user, orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (!month || Number.isNaN(week) || week < 1 || week > 4) {
        return res.status(400).json({ error: 'Invalid month/week query' });
    }

    try {
        const history = (await db.query(`
            SELECT h.id, h.previous_objective_text, h.objective_text, h.changed_at, h.changed_by, u.name as changed_by_name
            FROM weekly_objective_audit h
            LEFT JOIN users u ON u.id = h.changed_by
            WHERE h.org_id = ? AND h.month_key = ? AND h.week_number = ?
            ORDER BY h.changed_at DESC
            LIMIT 20
        `, [orgId, month, week])).rows;

        res.json({ orgId, month, week, history });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const upsertWeeklyObjective = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const user = req.user;
    const month = typeof req.body.month === 'string' ? req.body.month : '';
    const week = Number(req.body.week);
    const objective = typeof req.body.objective === 'string' ? req.body.objective : '';

    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!canAccessOrg(user, orgId) || !isPrivileged(user.role)) return res.status(403).json({ error: 'Forbidden' });
    if (!month || Number.isNaN(week) || week < 1 || week > 4) {
        return res.status(400).json({ error: 'Invalid month/week payload' });
    }

    try {
        const existing = first((await db.query(
            'SELECT id, objective_text FROM weekly_objectives WHERE org_id = ? AND month_key = ? AND week_number = ?',
            [orgId, month, week]
        )).rows);
        const now = new Date().toISOString();
        const previousObjective = existing?.objective_text || null;

        if (existing) {
            await db.execute(
                'UPDATE weekly_objectives SET objective_text = ?, updated_by = ?, updated_at = ? WHERE id = ?',
                [objective, user.userId, now, existing.id]
            );
        } else {
            await db.execute(
                'INSERT INTO weekly_objectives (id, org_id, month_key, week_number, objective_text, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [uuidv4(), orgId, month, week, objective, user.userId, now]
            );
        }

        await db.execute(
            'INSERT INTO weekly_objective_audit (id, org_id, month_key, week_number, previous_objective_text, objective_text, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), orgId, month, week, previousObjective, objective, user.userId, now]
        );

        const changedByUser = first((await db.query('SELECT name FROM users WHERE id = ?', [user.userId])).rows);
        const membersToNotify = asRows<NotificationRecipient>((await db.query(
            'SELECT id, email, name, phone_number FROM users WHERE org_id = ? AND id != ?',
            [orgId, user.userId]
        )).rows);
        for (const member of membersToNotify) {
            await sendNotification(
                member,
                `Weekly objective updated for ${month} Week ${week} by ${changedByUser?.name || 'an admin'}.`
            );
        }

        res.json({ success: true, orgId, month, week, objective, updated_at: now, updated_by: user.userId });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const requestOrgSuperAdminPromotion = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const requester = req.user;
    const requesterId = requester?.userId;
    const { targetUserId, currentPassword } = req.body as { targetUserId?: string; currentPassword?: string };

    if (!requester || !requesterId) return res.status(401).json({ error: 'Unauthorized' });
    if (!canAccessOrg(requester, orgId) || !isPrivileged(requester.role)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!targetUserId || !currentPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const requesterRow = first(asRows<NotificationRecipient & { password_hash: string }>((await db.query('SELECT id, password_hash, email, name, phone_number FROM users WHERE id = ? AND org_id = ?', [requesterId, orgId])).rows));
        if (!requesterRow) return res.status(403).json({ error: 'Forbidden' });

        const passwordOk = bcrypt.compareSync(currentPassword, requesterRow.password_hash);
        if (!passwordOk) {
            return res.status(403).json({ error: 'Invalid credentials' });
        }

        const targetRow = first((await db.query('SELECT id, name, role FROM users WHERE id = ? AND org_id = ?', [targetUserId, orgId])).rows);
        if (!targetRow) return res.status(404).json({ error: 'Target member not found' });
        if (targetRow.role === 'super_admin') {
            return res.status(400).json({ error: 'System super admins cannot be modified in this workflow' });
        }
        if (targetRow.role === 'org_super_admin') {
            return res.status(400).json({ error: 'Target user is already org super admin' });
        }

        const approvalCode = crypto.randomInt(100000, 999999).toString();
        const codeHash = crypto.createHash('sha256').update(approvalCode).digest('hex');
        const requestId = uuidv4();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await db.execute(
            'INSERT INTO org_role_change_requests (id, org_id, requester_user_id, target_user_id, desired_role, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [requestId, orgId, requesterId, targetUserId, 'org_super_admin', codeHash, expiresAt]
        );

        await sendNotification(
            requesterRow,
            `Approval code ${approvalCode}. Use it within 10 minutes to confirm org super admin change for ${targetRow.name}.`
        );

        res.json({
            success: true,
            requestId,
            expiresAt,
            message: 'Approval code sent to your notifications.'
        });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const confirmOrgSuperAdminPromotion = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const requester = req.user;
    const requesterId = requester?.userId;
    const { requestId, approvalCode } = req.body as { requestId?: string; approvalCode?: string };

    if (!requester || !requesterId) return res.status(401).json({ error: 'Unauthorized' });
    if (!canAccessOrg(requester, orgId) || !isPrivileged(requester.role)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!requestId || !approvalCode) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const roleChange = first(asRows<{
            id: string;
            target_user_id: string;
            code_hash: string;
            expires_at: string;
            used_at?: string | null;
        }>((await db.query(
            'SELECT * FROM org_role_change_requests WHERE id = ? AND org_id = ? AND requester_user_id = ?',
            [requestId, orgId, requesterId]
        )).rows));
        if (!roleChange) return res.status(404).json({ error: 'Role change request not found' });
        if (roleChange.used_at) return res.status(400).json({ error: 'Role change request already used' });

        const expiry = new Date(roleChange.expires_at);
        if (Number.isNaN(expiry.getTime()) || expiry.getTime() < Date.now()) {
            return res.status(400).json({ error: 'Role change request expired' });
        }

        const providedHash = crypto.createHash('sha256').update(approvalCode).digest('hex');
        if (providedHash !== roleChange.code_hash) {
            return res.status(403).json({ error: 'Invalid approval code' });
        }

        const targetMember = first(asRows<NotificationRecipient & { role: string }>((await db.query('SELECT id, name, role, email, phone_number FROM users WHERE id = ? AND org_id = ?', [roleChange.target_user_id, orgId])).rows));
        if (!targetMember) return res.status(404).json({ error: 'Target member not found' });
        if (targetMember.role === 'super_admin') {
            return res.status(400).json({ error: 'System super admins cannot be modified in this workflow' });
        }

        await db.transaction(async (tx: DatabaseAdapter) => {
            await tx.execute('UPDATE users SET role = ? WHERE org_id = ? AND role = ? AND id != ?', ['admin', orgId, 'org_super_admin', targetMember.id]);
            await tx.execute('UPDATE users SET role = ? WHERE id = ?', ['org_super_admin', targetMember.id]);
            await tx.execute('UPDATE org_role_change_requests SET used_at = ? WHERE id = ?', [new Date().toISOString(), requestId]);
        });

        await sendNotification(
            targetMember,
            'Your role has been updated to org_super_admin. You now have organization-wide management access.'
        );

        res.json({ success: true, targetUserId: targetMember.id, newRole: 'org_super_admin' });
    } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const updateBoard = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const { name, archived, followers } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    try {
        // 1. Fetch Board to check ownership
        const board = first(asRows<BoardAccessRow>((await db.query('SELECT created_by, org_id FROM boards WHERE id = ?', [id])).rows));

        if (!board) {
            return res.status(404).json({ error: 'Board not found' });
        }

        // 2. Permission Check: Admin OR Creator
        const isCreator = board.created_by === userId;
        const isAdmin = isPrivileged(userRole);
        const inScope = canAccessOrg(req.user, board.org_id);

        if ((!isCreator && !isAdmin) || !inScope) {
            return res.status(403).json({ error: 'Only admins or the board creator can update this board' });
        }

        if (name !== undefined) {
            await db.execute('UPDATE boards SET name = ? WHERE id = ?', [name, id]);
        }
        if (archived !== undefined) {
            await db.execute('UPDATE boards SET archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
        }
        if (followers !== undefined) {
            await db.execute('UPDATE boards SET followers = ? WHERE id = ?', [followers, id]);
        }
        if (req.body.isPublic !== undefined) {
            await db.execute('UPDATE boards SET is_public = ? WHERE id = ?', [req.body.isPublic ? 1 : 0, id]);
        }
        res.json({ success: true, id });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Update failed' });
    }
};

export const deleteBoard = async (req: AuthenticatedRequest, res: Response) => {
    if (!isPrivileged(req.user?.role)) {
        return res.status(403).json({ error: 'Only admins can delete boards' });
    }

    const id = String(req.params.id);
    try {
        const board = await getBoardForAccess(id);
        if (!board) return res.status(404).json({ error: 'Board not found' });
        if (!canAccessOrg(req.user, board.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await db.transaction(async (tx: DatabaseAdapter) => {
            const columns = asRows<{ id: string }>((await tx.query('SELECT id FROM columns WHERE board_id = ?', [id])).rows);
            for (const col of columns) {
                await tx.execute('DELETE FROM tasks WHERE column_id = ?', [col.id]);
            }
            await tx.execute('DELETE FROM columns WHERE board_id = ?', [id]);
            await tx.execute('DELETE FROM boards WHERE id = ?', [id]);
        });
        res.json({ success: true, id });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Delete failed' });
    }
};

export const deleteOrganization = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id); // Org ID
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!isPrivileged(user.role)) {
        return res.status(403).json({ error: 'Only admin users can delete organizations' });
    }
    if (user.role !== 'super_admin' && user.orgId !== id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    try {
        await db.transaction(async (tx: DatabaseAdapter) => {
            // 1. Get all Boards
            const boards = asRows<{ id: string }>((await tx.query('SELECT id FROM boards WHERE org_id = ?', [id])).rows);
            for (const board of boards) {
                // Delete Tasks and Columns for each board (Duplicate of deleteBoard logic, but in one tx)
                const columns = asRows<{ id: string }>((await tx.query('SELECT id FROM columns WHERE board_id = ?', [board.id])).rows);
                for (const col of columns) {
                    await tx.execute('DELETE FROM tasks WHERE column_id = ?', [col.id]);
                }
                await tx.execute('DELETE FROM columns WHERE board_id = ?', [board.id]);
            }
            // 2. Delete Boards
            await tx.execute('DELETE FROM boards WHERE org_id = ?', [id]);

            // 3. Delete Users
            await tx.execute('DELETE FROM users WHERE org_id = ?', [id]);

            // 4. Delete Organization
            await tx.execute('DELETE FROM organizations WHERE id = ?', [id]);
        });

        res.json({ success: true, message: 'Organization and all associated data deleted.' });
    } catch (err: unknown) {
        console.error("Delete Org Failed", err);
        res.status(500).json({ error: 'Failed to delete organization' });
    }
};

export const toggleTaskInterest = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user?.userId;
    try {
        const taskScope = await getTaskScope(id);
        if (!taskScope) return res.status(404).json({ error: 'Task not found' });
        if (!canAccessOrg(req.user, taskScope.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const task = first(asRows<{ interested_users?: string | null; title: string; column_id: string }>((await db.query('SELECT interested_users, title, column_id FROM tasks WHERE id = ?', [id])).rows));
        if (!task) return res.status(404).json({ error: 'Task not found' });

        let interested = parseCsvIds(task.interested_users);
        let added = false;
        if (userId && interested.includes(userId)) {
            interested = interested.filter((u: string) => u !== userId);
        } else if (userId) {
            interested.push(userId);
            added = true;
        }
        const newValue = interested.join(',');

        await db.execute('UPDATE tasks SET interested_users = ? WHERE id = ?', [newValue, id]);

        // Notify Admin if Added Interest
        if (added && userId) {
            console.log('[DEBUG] Interest added by user:', userId);
            // Find Board Owner
            const col = first((await db.query('SELECT board_id FROM columns WHERE id = ?', [task.column_id])).rows);
            if (col) {
                const board = first((await db.query('SELECT created_by, name FROM boards WHERE id = ?', [col.board_id])).rows);
                console.log('[DEBUG] Found Board:', board);
                if (board && board.created_by) {
                    if (board.created_by !== userId) {
                        const owner = first(asRows<NotificationRecipient>((await db.query('SELECT id, email, phone_number, name FROM users WHERE id = ?', [board.created_by])).rows));
                        console.log('[DEBUG] Found Owner:', owner);
                        const userWhoInterested = first((await db.query('SELECT name FROM users WHERE id = ?', [userId])).rows);
                        if (owner) {
                            console.log('[DEBUG] Sending Notification to Owner...');
                            await sendNotification(owner, `User ${userWhoInterested?.name || 'Someone'} marked interest in task "${task.title}" on board "${board.name}"`);
                        } else {
                            console.log('[DEBUG] Owner not found in users table');
                        }
                    } else {
                        console.log('[DEBUG] User is the board owner, skipping notification');
                    }
                } else {
                    console.log('[DEBUG] Board not found or no creator');
                }
            } else {
                console.log('[DEBUG] Column not found for task');
            }
        } else {
            console.log('[DEBUG] Interest removed or no user ID');
        }

        res.json({ success: true, interested_users: newValue });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to toggle interest' });
    }
};

const canInviteToTask = (user: AuthenticatedRequest['user'], taskScope: { org_id: string; created_by?: string | null }) =>
    Boolean(user && canAccessOrg(user, taskScope.org_id) && (isPrivileged(user.role) || user.userId === taskScope.created_by));

/** GET /orgs/:orgId/invite-candidates?q=&taskId= - List org members for inviting to a task (admins/board creators). */
export const getInviteCandidates = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!canAccessOrg(req.user, orgId)) return res.status(403).json({ error: 'Forbidden' });
        if (taskId) {
            const taskScope = await getTaskScope(taskId);
            if (!taskScope || !canInviteToTask(req.user, taskScope)) return res.status(403).json({ error: 'Forbidden' });
        } else if (!isPrivileged(req.user.role)) return res.status(403).json({ error: 'Only org/board admins can list invite candidates' });

        let rows = asRows<{ id: string; name: string; email: string; skills?: string | null }>((await db.query(
            'SELECT id, name, email, skills FROM users WHERE org_id = ? ORDER BY name',
            [orgId]
        )).rows);

        if (q) {
            rows = rows.filter((u) =>
                u.name.toLowerCase().includes(q) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.skills && u.skills.toLowerCase().includes(q))
            );
        }

        res.json(rows.map((u) => ({ id: u.id, name: u.name, email: u.email, skills: u.skills || null })));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

/** GET /orgs/:orgId/tasks-for-invite - List tasks in org that the user can invite people to. */
export const getTasksForInvite = async (req: AuthenticatedRequest, res: Response) => {
    const orgId = String(req.params.orgId);
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!canAccessOrg(req.user, orgId)) return res.status(403).json({ error: 'Forbidden' });

        const tasks = asRows<{ task_id: string; task_title: string; board_id: string; board_name: string; created_by?: string | null }>((await db.query(`
            SELECT t.id AS task_id, t.title AS task_title, b.id AS board_id, b.name AS board_name, b.created_by
            FROM tasks t
            JOIN columns c ON c.id = t.column_id
            JOIN boards b ON b.id = c.board_id
            WHERE b.org_id = ?
            ORDER BY b.name, t.title
        `, [orgId])).rows);

        const allowed = tasks.filter((row) => isPrivileged(req.user!.role) || req.user!.userId === row.created_by);
        res.json(allowed.map((row) => ({
            id: row.task_id,
            title: row.task_title,
            boardId: row.board_id,
            boardName: row.board_name
        })));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

/** POST /tasks/:taskId/invites - Send a task invite (admin or board creator). */
export const sendTaskInvite = async (req: AuthenticatedRequest, res: Response) => {
    const taskId = String(req.params.taskId);
    const { inviteeUserId, message } = req.body as { inviteeUserId?: string; message?: string };
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!inviteeUserId) return res.status(400).json({ error: 'inviteeUserId required' });
        const taskScope = await getTaskScope(taskId);
        if (!taskScope) return res.status(404).json({ error: 'Task not found' });
        if (!canInviteToTask(req.user, taskScope)) return res.status(403).json({ error: 'Forbidden' });

        const invitee = first(asRows<{ id: string; org_id: string }>((await db.query('SELECT id, org_id FROM users WHERE id = ?', [inviteeUserId])).rows));
        if (!invitee) return res.status(404).json({ error: 'User not found' });
        if (invitee.org_id !== taskScope.org_id) return res.status(400).json({ error: 'Can only invite members of the same organization' });
        if (inviteeUserId === req.user.userId) return res.status(400).json({ error: 'Cannot invite yourself' });

        const existing = first((await db.query(
            'SELECT id FROM task_invites WHERE task_id = ? AND invitee_user_id = ? AND status = ?',
            [taskId, inviteeUserId, 'pending']
        )).rows);
        if (existing) return res.status(409).json({ error: 'This user already has a pending invite for this task' });

        const id = uuidv4();
        await db.execute(
            'INSERT INTO task_invites (id, task_id, inviter_user_id, invitee_user_id, message, status) VALUES (?, ?, ?, ?, ?, ?)',
            [id, taskId, req.user.userId, inviteeUserId, message || null, 'pending']
        );

        const task = first((await db.query('SELECT title FROM tasks WHERE id = ?', [taskId])).rows) as { title?: string } | undefined;
        const inviterName = first((await db.query('SELECT name FROM users WHERE id = ?', [req.user.userId])).rows) as { name?: string } | undefined;
        const inviteeRow = first(asRows<NotificationRecipient>((await db.query('SELECT id, email, phone_number, name FROM users WHERE id = ?', [inviteeUserId])).rows));
        if (inviteeRow) {
            await sendNotification(inviteeRow, `You're invited to consider the task "${task?.title || 'Task'}" by ${inviterName?.name || 'An admin'}. Check your profile Task Invites.`, 'task_invite');
        }
        res.status(201).json({ id, taskId, inviteeUserId, status: 'pending' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

/** GET /invites - List task invites received by the current user. */
export const getMyInvites = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    try {
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const rows = asRows<{ id: string; task_id: string; inviter_user_id: string; message: string | null; status: string; created_at: string }>((await db.query(
            'SELECT id, task_id, inviter_user_id, message, status, created_at FROM task_invites WHERE invitee_user_id = ? ORDER BY created_at DESC',
            [userId]
        )).rows);
        const invites: { id: string; taskId: string; taskTitle: string; boardName: string; inviterName: string; message: string | null; status: string; createdAt: string }[] = [];
        for (const row of rows) {
            const task = first(asRows<{ title: string; column_id: string }>((await db.query('SELECT title, column_id FROM tasks WHERE id = ?', [row.task_id])).rows));
            const col = task ? first((await db.query('SELECT board_id FROM columns WHERE id = ?', [task.column_id])).rows) as { board_id?: string } | undefined : null;
            const board = col ? first(asRows<{ name: string }>((await db.query('SELECT name FROM boards WHERE id = ?', [col.board_id])).rows)) : null;
            const inviter = first(asRows<{ name: string }>((await db.query('SELECT name FROM users WHERE id = ?', [row.inviter_user_id])).rows));
            invites.push({
                id: row.id,
                taskId: row.task_id,
                taskTitle: task?.title || 'Task',
                boardName: board?.name || 'Board',
                inviterName: inviter?.name || 'Someone',
                message: row.message,
                status: row.status,
                createdAt: row.created_at
            });
        }
        res.json(invites);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

/** POST /invites/:id/accept - Accept a task invite (add to interested_users, mark accepted). */
export const acceptTaskInvite = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user?.userId;
    try {
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const invite = first(asRows<{ id: string; task_id: string; invitee_user_id: string; status: string }>((await db.query(
            'SELECT id, task_id, invitee_user_id, status FROM task_invites WHERE id = ?',
            [id]
        )).rows));
        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.invitee_user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
        if (invite.status !== 'pending') return res.status(400).json({ error: 'Invite already responded to' });

        const task = first(asRows<{ interested_users?: string | null }>((await db.query('SELECT interested_users FROM tasks WHERE id = ?', [invite.task_id])).rows));
        if (!task) return res.status(404).json({ error: 'Task not found' });
        const interested = parseCsvIds(task.interested_users);
        if (!interested.includes(userId)) {
            interested.push(userId);
            await db.execute('UPDATE tasks SET interested_users = ? WHERE id = ?', [interested.join(','), invite.task_id]);
        }
        await db.execute('UPDATE task_invites SET status = ? WHERE id = ?', ['accepted', id]);

        const inviterIdRow = first(asRows<{ inviter_user_id: string }>((await db.query('SELECT inviter_user_id FROM task_invites WHERE id = ?', [id])).rows));
        const inviter = inviterIdRow ? first(asRows<NotificationRecipient>((await db.query('SELECT id, email, phone_number, name FROM users WHERE id = ?', [inviterIdRow.inviter_user_id])).rows)) : null;
        const me = first((await db.query('SELECT name FROM users WHERE id = ?', [userId])).rows) as { name?: string } | undefined;
        if (inviter) await sendNotification(inviter, `${me?.name || 'A member'} accepted your task invite.`);
        res.json({ success: true, status: 'accepted' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

/** POST /invites/:id/decline - Decline a task invite. */
export const declineTaskInvite = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user?.userId;
    try {
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const invite = first(asRows<{ invitee_user_id: string; status: string }>((await db.query(
            'SELECT invitee_user_id, status FROM task_invites WHERE id = ?',
            [id]
        )).rows));
        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.invitee_user_id !== userId) return res.status(403).json({ error: 'Forbidden' });
        if (invite.status !== 'pending') return res.status(400).json({ error: 'Invite already responded to' });
        await db.execute('UPDATE task_invites SET status = ? WHERE id = ?', ['declined', id]);
        res.json({ success: true, status: 'declined' });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const toggleBoardFollow = async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user?.userId;

    try {
        const board = first(asRows<{ followers?: string | null; org_id: string }>((await db.query('SELECT followers, org_id FROM boards WHERE id = ?', [id])).rows));
        if (!board) return res.status(404).json({ error: 'Board not found' });
        if (!canAccessOrg(req.user, board.org_id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const followers = parseCsvIds(board.followers);
        let newFollowers = [...followers];
        if (userId && followers.includes(userId)) {
            newFollowers = newFollowers.filter((u: string) => u !== userId);
        } else if (userId) {
            newFollowers.push(userId);
        }
        const newValue = newFollowers.join(',');

        await db.execute('UPDATE boards SET followers = ? WHERE id = ?', [newValue, id]);
        res.json({ success: true, followers: newValue });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to toggle follow' });
    }
};

export const switchOrganization = async (req: AuthenticatedRequest, res: Response) => {
    const targetOrgId = String(req.body?.orgId || '');
    const userId = req.user?.userId;

    if (!userId || !targetOrgId) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const org = first((await db.query('SELECT id, name FROM organizations WHERE id = ?', [targetOrgId])).rows);
        if (!org) return res.status(404).json({ error: 'Organization not found' });

        const currentUser = first((await db.query(
            'SELECT id, org_id, role FROM users WHERE id = ?',
            [userId]
        )).rows);
        if (!currentUser) return res.status(404).json({ error: 'User not found' });

        // Preserve role when no real org change happens.
        if (currentUser.org_id === targetOrgId) {
            return res.json({
                success: true,
                orgId: targetOrgId,
                orgName: org.name,
                role: currentUser.role
            });
        }

        // Keep super admin authority across organizations.
        const nextRole = currentUser.role === 'super_admin' ? 'super_admin' : 'member';

        await db.execute(
            'UPDATE users SET org_id = ?, role = ? WHERE id = ?',
            [targetOrgId, nextRole, userId]
        );

        res.json({ success: true, orgId: targetOrgId, orgName: org.name, role: nextRole });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to switch organization' });
    }
};

export const translateText = async (req: Request, res: Response) => {
    try {
        const { text, sourceLang, targetLang } = req.body;

        if (!text || !targetLang) {
            return res.status(400).json({ error: 'Missing text or targetLang' });
        }

        // Use MyMemory API
        // Pair: sourceLang|targetLang
        const pair = `${sourceLang}|${targetLang}`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;

        const response = await fetch(url);
        const data = await response.json() as { responseStatus?: number; responseData?: { translatedText?: string }; responseDetails?: unknown };

        if (data.responseStatus === 200) {
            res.json({ translatedText: data.responseData?.translatedText });
        } else {
            // Fallback or error
            console.error('Translation error:', data);
            res.status(500).json({ error: 'Translation failed', details: data });
        }

    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { name, email, username, phoneNumber, phone_number, password, skills, location, recurringDuties } = req.body;
    const normalizedPhone = phoneNumber ?? phone_number ?? null;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const parsedRecurringDuties = sanitizeRecurringDuties(recurringDuties);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const currentUserRow = first((await db.query('SELECT id, username, org_id FROM users WHERE id = ?', [userId])).rows);
        if (!currentUserRow) return res.status(404).json({ error: 'User not found' });

        // Username can be set later for legacy users who registered before username was required.
        // If already set, keep it immutable to avoid identity churn.
        if (normalizedUsername && normalizedUsername !== (currentUserRow.username || '')) {
            if (currentUserRow.username) {
                return res.status(400).json({ error: 'Username already set and cannot be changed' });
            }
            const existingUsername = await db.query('SELECT id FROM users WHERE LOWER(username) = ? AND id <> ?', [normalizedUsername, userId]);
            if (existingUsername.rows.length > 0) {
                return res.status(400).json({ error: 'Username already registered' });
            }
        }

        let sql = 'UPDATE users SET name = ?, email = ?, phone_number = ?, skills = ?, location = ?';
        const params: unknown[] = [name, normalizedEmail, normalizedPhone, skills ?? null, location ?? null];

        if (!currentUserRow.username && normalizedUsername) {
            sql += ', username = ?';
            params.push(normalizedUsername);
        }

        if (password && password.trim() !== '') {
            const hashedPassword = bcrypt.hashSync(password, 10);
            sql += ', password_hash = ?';
            params.push(hashedPassword);
        }

        sql += ' WHERE id = ?';
        params.push(userId);

        await db.transaction(async (tx: DatabaseAdapter) => {
            await tx.execute(sql, params);
            if (Array.isArray(recurringDuties)) {
                await tx.execute('DELETE FROM user_recurring_duties WHERE user_id = ?', [userId]);
                for (const duty of parsedRecurringDuties) {
                    await tx.execute(
                        `INSERT INTO user_recurring_duties
                        (id, user_id, org_id, title, cadence, day_of_week, start_time, end_time, location, notes, active, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            uuidv4(),
                            userId,
                            currentUserRow.org_id,
                            duty.title,
                            duty.cadence,
                            duty.dayOfWeek ?? null,
                            duty.startTime,
                            duty.endTime,
                            duty.location || null,
                            duty.notes || null,
                            duty.active === false ? 0 : 1,
                            new Date().toISOString()
                        ]
                    );
                }
            }
        });

        // Fetch updated user to return (excluding password)
        const user = first((await db.query('SELECT id, name, username, email, role, phone_number, skills, location, last_board_id FROM users WHERE id = ?', [userId])).rows);
        const recurringDutyRows = (await db.query(
            `SELECT id, title, cadence, day_of_week, start_time, end_time, location, notes, active
             FROM user_recurring_duties
             WHERE user_id = ? AND active = 1
             ORDER BY title ASC`,
            [userId]
        )).rows;
        const recurringDutiesResponse = asRows<RecurringDutyRow>(recurringDutyRows).map((duty) => ({
            id: duty.id,
            title: duty.title,
            cadence: duty.cadence,
            dayOfWeek: duty.day_of_week,
            startTime: duty.start_time,
            endTime: duty.end_time,
            location: duty.location || null,
            notes: duty.notes || null
        }));

        res.json({ success: true, user, recurringDuties: recurringDutiesResponse });
    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // 1. Get User Details
        const user = first((await db.query('SELECT id, name, username, email, role, phone_number, skills, location, org_id FROM users WHERE id = ?', [userId])).rows);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // 2. Get Organization Details
        const org = first((await db.query('SELECT id, name FROM organizations WHERE id = ?', [user.org_id])).rows);

        // 3. Get Interested Tasks
        // Conditions: 
        // - User ID is in task.interested_users
        // - Task is NOT archived (completed/removed)
        // - User ID is in board.followers (user hasn't left the board)
        const interestedTasks = (await db.query(`
            SELECT t.id, t.title, t.priority_score, b.name as board_name, b.id as board_id
            FROM tasks t
            JOIN columns c ON t.column_id = c.id
            JOIN boards b ON c.board_id = b.id
            WHERE ',' || t.interested_users || ',' LIKE ?
            AND (t.archived = 0 OR t.archived IS NULL)
            AND ',' || b.followers || ',' LIKE ?
        `, [`%,${userId},%`, `%,${userId},%`])).rows;

        const recurringDutyRows = (await db.query(
            `SELECT id, title, cadence, day_of_week, start_time, end_time, location, notes, active
             FROM user_recurring_duties
             WHERE user_id = ? AND active = 1
             ORDER BY title ASC`,
            [userId]
        )).rows;
        const recurringDuties = asRows<RecurringDutyRow>(recurringDutyRows).map((duty) => ({
            id: duty.id,
            title: duty.title,
            cadence: duty.cadence,
            dayOfWeek: duty.day_of_week,
            startTime: duty.start_time,
            endTime: duty.end_time,
            location: duty.location || null,
            notes: duty.notes || null
        }));

        res.json({
            user,
            organization: org,
            interestedTasks,
            recurringDuties
        });

    } catch (err: unknown) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};


// Super Admin Management Controllers

export const deleteOrganizationAdmin = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    try {
        await db.transaction(async (tx: DatabaseAdapter) => {
            // 1. Delete Tasks (via Columns via Boards)
            await tx.execute(`
                DELETE FROM tasks 
                WHERE column_id IN (
                    SELECT id FROM columns 
                    WHERE board_id IN (
                        SELECT id FROM boards WHERE org_id = ?
                    )
                )
            `, [id]);

            // 2. Delete Columns (via Boards)
            await tx.execute(`
                DELETE FROM columns 
                WHERE board_id IN (
                    SELECT id FROM boards WHERE org_id = ?
                )
            `, [id]);

            // 3. Delete Boards
            await tx.execute('DELETE FROM boards WHERE org_id = ?', [id]);

            // 4. Delete Notifications (via Users)
            await tx.execute(`
                DELETE FROM notifications 
                WHERE user_id IN (
                    SELECT id FROM users WHERE org_id = ?
                )
            `, [id]);

            // 5. Delete Users
            await tx.execute('DELETE FROM users WHERE org_id = ?', [id]);

            // 6. Delete Organization
            await tx.execute('DELETE FROM organizations WHERE id = ?', [id]);
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to delete organization' });
    }
};

export const updateOrganizationAdmin = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { name } = req.body;
    try {
        await db.execute('UPDATE organizations SET name = ? WHERE id = ?', [name, id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update organization' });
    }
};

export const getOrgBoardsAdmin = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    try {
        const boards = (await db.query('SELECT * FROM boards WHERE org_id = ?', [id])).rows;
        res.json(boards);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch boards' });
    }
};

export const updateUserAdmin = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { name, email } = req.body;
    try {
        await db.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

export const deleteUserAdmin = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    try {
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

export const resetPasswordAdmin = async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { password } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

// Password Recovery Controllers

export const requestPasswordReset = async (req: Request, res: Response) => {
    const { email } = req.body;
    try {
        const user = first((await db.query('SELECT * FROM users WHERE email = ?', [email])).rows);
        if (!user) {
            // Security: Don't reveal if user exists
            return res.json({ success: true, message: 'If an account exists, a recovery email has been sent.' });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 3600000).toISOString();

        await db.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
        await db.execute(
            'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
            [uuidv4(), user.id, tokenHash, expiresAt]
        );

        // Simulate Email
        console.log('===========================================================');
        console.log(`[EMAIL SIMULATION] Password Reset Request for ${email}`);
        console.log(`[EMAIL SIMULATION] Click here to reset: http://localhost:5173/reset-password?token=${rawToken}`);
        console.log('===========================================================');

        res.json({ success: true, message: 'If an account exists, a recovery email has been sent.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal error' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    try {
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const resetRow = first(asRows<{ id: string; user_id: string; expires_at: string; used_at?: string | null }>((await db.query(
            'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
            [tokenHash]
        )).rows));
        if (!resetRow) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        if (resetRow.used_at) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }
        const expiresAt = new Date(resetRow.expires_at);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        await db.transaction(async (tx: DatabaseAdapter) => {
            await tx.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, resetRow.user_id]);
            await tx.execute('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?', [new Date().toISOString(), resetRow.id]);
        });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};
