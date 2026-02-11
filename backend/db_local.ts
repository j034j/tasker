
import Database from 'better-sqlite3';
import { DatabaseAdapter, QueryResult } from './db_adapter';

export class LocalAdapter implements DatabaseAdapter {
    private db: Database.Database;

    constructor(filename: string) {
        this.db = new Database(filename);
        this.db.pragma('journal_mode = WAL');
    }

    async query(sql: string, params: any[] = []): Promise<QueryResult> {
        try {
            // Check if it's a SELECT query
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                const rows = this.db.prepare(sql).all(params);
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

    async execute(sql: string, params: any[] = []): Promise<QueryResult> {
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
        // better-sqlite3 transactions are synchronous blocking.
        // We can wrap the sync transaction... but the INNER logic (the action) is likely async (based on our Interface).
        // This is tricky. better-sqlite3 transaction() expects a synchronous function.
        // If 'action' returns a Promise, better-sqlite3 will return a Promise (the result).
        // BUT better-sqlite3 transactions commit when the function returns.
        // If the function returns a Promise, it commits the *Promise object*, not the result!
        // So the async operations might happen AFTER the commit?
        // NO, better-sqlite3 transaction function MUST be synchronous.

        // WORKAROUND:
        // Since better-sqlite3 is local file access, we technically don't need async for *it* specifically.
        // But our Interface demands async for Turso compatibility.
        // 
        // For LocalAdapter, we might have to accept that we CANNOT do true async transactions easily inside strict Better-SQLite3 .transaction() wrapper if we want to await things inside.
        // However, since local db operations are actually sync, maybe we don't need to await them *inside* the transaction logic if we use the underlying sync db?
        // No, the Interface `query` returns Promise.

        // Strategy: A simple "serialize" lock implementation isn't enough for ACID.
        // We might just use `BEGIN`, `COMMIT`, `ROLLBACK` manually for the Local Adapter if we need async flow support.

        this.db.prepare('BEGIN').run();
        try {
            const result = await action(this);
            this.db.prepare('COMMIT').run();
            return result;
        } catch (err) {
            this.db.prepare('ROLLBACK').run();
            throw err;
        }
    }

    // Helper to access raw DB if absolutely needed (should avoid)
    getRawDb() {
        return this.db;
    }
}
