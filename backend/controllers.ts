
import { Request, Response } from 'express';
import db from './db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseAdapter } from './db_adapter';

const JWT_SECRET = process.env.JWT_SECRET || 'tasker-dev-secret';

// Helper to get first row safely
const first = (rows: any[]) => rows && rows.length > 0 ? rows[0] : undefined;

export const registerOrg = async (req: Request, res: Response) => {
    console.log('Register Request Body:', req.body);
    const { orgName, userName, email, password } = req.body;

    // Check if email exists
    try {
        const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        console.log('Existing Check Result:', existing.rows);
        if (existing.rows.length > 0) {
            console.warn('Email already registered:', email);
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const orgId = uuidv4();
        const userId = uuidv4();

        console.log('Starting Transaction for Org:', orgId);
        // Transaction to create Org and User
        const result = await db.transaction(async (tx) => {
            console.log('Inserting Org...');
            await tx.execute('INSERT INTO organizations (id, name) VALUES (?, ?)', [orgId, orgName]);
            console.log('Inserting User...');
            await tx.execute(
                'INSERT INTO users (id, name, email, password_hash, org_id, role) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, userName, email, hashedPassword, orgId, 'admin']
            );
            return { orgId, userId };
        });
        console.log('Transaction Success');

        const token = jwt.sign({ userId, orgId, role: 'admin' }, JWT_SECRET);
        res.json({
            success: true,
            orgId,
            userId,
            token,
            orgName,
            user: { id: userId, name: userName, email, role: 'admin' }
        });

    } catch (err: unknown) {
        console.error('Register Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(400).json({ error: message });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const userRow = first((await db.query('SELECT * FROM users WHERE email = ?', [email])).rows);

        if (!userRow) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, userRow.password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: userRow.id, orgId: userRow.org_id, role: userRow.role }, JWT_SECRET);

        const orgRow = first((await db.query('SELECT name FROM organizations WHERE id = ?', [userRow.org_id])).rows);

        res.json({
            success: true,
            token,
            orgId: userRow.org_id,
            orgName: orgRow ? orgRow.name : 'Unknown Org',
            user: { id: userRow.id, name: userRow.name, email: userRow.email, role: userRow.role }
        });
    } catch (err) {
        console.error("Login error", err);
        res.status(500).json({ error: 'Login failed' });
    }
};

export const createBoard = async (req: Request, res: Response) => {
    const { name, orgId } = req.body;
    const id = uuidv4();

    try {
        await db.execute('INSERT INTO boards (id, name, org_id) VALUES (?, ?, ?)', [id, name, orgId]);

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

        res.json({ id, name, orgId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const createTask = async (req: Request, res: Response) => {
    const {
        columnId, title, description, urgency, dueDate,
        weatherSensitive, fundingNeeded, assignedTo, peopleRequired, skills,
        weatherIndex, fundingFactor, skillAvailability, projectDuration, projectLocation,
        weatherCode
    } = req.body;
    const id = uuidv4();
    const score = 0;

    try {
        await db.execute(`
            INSERT INTO tasks (
                id, column_id, title, description, assigned_to, 
                urgency, due_date, weather_sensitive, funding_needed, 
                people_required, skills,
                weather_index, funding_factor, skill_availability,
                priority_score, project_duration, project_location,
                weather_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, columnId, title, description, assignedTo,
            urgency, dueDate, weatherSensitive ? 1 : 0, fundingNeeded,
            peopleRequired || 1, skills || '',
            weatherIndex || 0, fundingFactor || 0, skillAvailability || 50,
            score, projectDuration || '', projectLocation || '',
            weatherCode !== undefined ? weatherCode : null
        ]);

        res.json({ id, title, priority_score: score });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getBoard = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { includeArchived } = req.query;

    try {
        const board = first((await db.query('SELECT * FROM boards WHERE id = ?', [id])).rows);
        if (!board) return res.status(404).json({ error: 'Board not found' });

        const columns = (await db.query('SELECT * FROM columns WHERE board_id = ? ORDER BY order_index', [id])).rows;

        // Fetch tasks for each column
        // Optimized: Fetch all tasks for board and distribute (reduce queries)?
        // For simplicity adapting existing structure, let's keep loop but beware n+1.
        // Turso is remote, n+1 is bad.
        // Better: Fetch all tasks for this board's columns. But we need column details.
        // Let's optimize: SELECT * FROM tasks WHERE column_id IN (...)

        let columnsWithTasks = [];
        for (const col of columns) {
            const query = includeArchived === 'true'
                ? 'SELECT * FROM tasks WHERE column_id = ? ORDER BY priority_score DESC'
                : 'SELECT * FROM tasks WHERE column_id = ? AND (archived = 0 OR archived IS NULL) ORDER BY priority_score DESC';

            const tasks = (await db.query(query, [col.id])).rows;
            columnsWithTasks.push({ ...col, tasks });
        }

        res.json({ ...board, columns: columnsWithTasks });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const moveTask = async (req: Request, res: Response) => {
    const { taskId, targetColumnId } = req.body;
    try {
        await db.execute('UPDATE tasks SET column_id = ? WHERE id = ?', [targetColumnId, taskId]);
        res.json({ success: true, taskId, targetColumnId });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const updateTask = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        title, description, urgency, dueDate,
        weatherSensitive, fundingNeeded, peopleRequired, skills,
        weather_index, funding_factor, skill_availability,
        archived, projectDuration, projectLocation, weatherCode
    } = req.body;

    try {
        await db.execute(`
            UPDATE tasks 
            SET title = ?, description = ?, urgency = ?, due_date = ?, 
                weather_sensitive = ?, funding_needed = ?,
                people_required = ?, skills = ?,
                weather_index = ?, funding_factor = ?, skill_availability = ?,
                archived = ?, project_duration = ?, project_location = ?,
                weather_code = ?
            WHERE id = ?
        `, [
            title, description, urgency, dueDate,
            weatherSensitive ? 1 : 0, fundingNeeded,
            peopleRequired, skills,
            weather_index, funding_factor, skill_availability,
            archived ? 1 : 0, projectDuration, projectLocation,
            weatherCode !== undefined ? weatherCode : null,
            id
        ]);

        res.json({ success: true, id });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const deleteTask = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ success: true, id });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const getBoards = async (req: Request, res: Response) => {
    const { orgId } = req.params;
    try {
        const result = await db.query('SELECT id, name FROM boards WHERE org_id = ? AND (archived = 0 OR archived IS NULL)', [orgId]);
        res.json(result.rows);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
};

export const updateBoard = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, archived } = req.body;
    try {
        if (name !== undefined) {
            await db.execute('UPDATE boards SET name = ? WHERE id = ?', [name, id]);
        }
        if (archived !== undefined) {
            await db.execute('UPDATE boards SET archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
        }
        res.json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Update failed' });
    }
};

export const deleteBoard = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await db.transaction(async (tx) => {
            const columns = (await tx.query('SELECT id FROM columns WHERE board_id = ?', [id])).rows;
            for (const col of columns) {
                await tx.execute('DELETE FROM tasks WHERE column_id = ?', [col.id]);
            }
            await tx.execute('DELETE FROM columns WHERE board_id = ?', [id]);
            await tx.execute('DELETE FROM boards WHERE id = ?', [id]);
        });
        res.json({ success: true, id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Delete failed' });
    }
};

export const deleteOrganization = async (req: Request, res: Response) => {
    const { id } = req.params; // Org ID
    // Security check logic usually goes here (middleware)

    try {
        await db.transaction(async (tx) => {
            // 1. Get all Boards
            const boards = (await tx.query('SELECT id FROM boards WHERE org_id = ?', [id])).rows;
            for (const board of boards) {
                // Delete Tasks and Columns for each board (Duplicate of deleteBoard logic, but in one tx)
                const columns = (await tx.query('SELECT id FROM columns WHERE board_id = ?', [board.id])).rows;
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
    } catch (err) {
        console.error("Delete Org Failed", err);
        res.status(500).json({ error: 'Failed to delete organization' });
    }
};
