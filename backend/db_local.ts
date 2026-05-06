import Database from 'better-sqlite3';
import type { DatabaseAdapter, QueryResult } from './db_adapter.js';

export class LocalAdapter implements DatabaseAdapter {
    private db: Database.Database;

    constructor(filename: string) {
        this.db = new Database(filename);
        this.db.pragma('journal_mode = WAL');
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        try {
            // Check if it's a SELECT query
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                const rows = this.db.prepare(sql).all(params) as Record<string, unknown>[];
                return { rows };
            } else {
                // For INSERT/UPDATE/DELETE, allow it in query() or use execute()
                const info = this.db.prepare(sql).run(params);
                return {
                    rows: [],
                    lastInsertRowid: info.lastInsertRowid,
                    changes: info.changes
                };
            }
        } catch (error) {
            console.error('Local DB Query Error:', error);
            throw error;
        }
    }

    async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
        // Use .exec() for scripts (no params, multi-statement support)
        if (!params || params.length === 0) {
            this.db.exec(sql);
            return { rows: [], changes: 0, lastInsertRowid: 0 };
        }

        // Use .prepare().run() for parameterized statements
        const info = this.db.prepare(sql).run(params);
        return {
            rows: [],
            lastInsertRowid: info.lastInsertRowid,
            changes: info.changes
        };
    }

    async transaction<T>(action: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
        // Use a SAVEPOINT-based approach so nested transactions are supported
        // and the async `action` can await adapter methods safely. We create a
        // savepoint, await the action, then release or rollback to the savepoint.
        const savepointName = `sp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        try {
            this.db.prepare(`SAVEPOINT ${savepointName}`).run();
            const result = await action(this);
            this.db.prepare(`RELEASE SAVEPOINT ${savepointName}`).run();
            return result;
        } catch (err) {
            try {
                this.db.prepare(`ROLLBACK TO SAVEPOINT ${savepointName}`).run();
                this.db.prepare(`RELEASE SAVEPOINT ${savepointName}`).run();
            } catch (rollbackErr) {
                console.error('Rollback to savepoint failed:', rollbackErr);
            }
            throw err;
        }
    }

    // Helper to access raw DB if absolutely needed (should avoid)
    getRawDb() {
        return this.db;
    }
}
