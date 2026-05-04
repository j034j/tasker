
import type { DatabaseAdapter, QueryResult } from './db_adapter.js';

// better-sqlite3 is a native addon only available in local/Node environments.
// We use a lazy dynamic import so it is only resolved when LocalAdapter is
// actually instantiated. In production (Vercel + Turso), this class is never
// constructed, so the native module is never loaded.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let BetterSqlite3: any = null;

async function getBetterSqlite3() {
    if (!BetterSqlite3) {
        const mod = await import('better-sqlite3');
        BetterSqlite3 = mod.default ?? mod;
    }
    return BetterSqlite3;
}

export class LocalAdapter implements DatabaseAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private db: any = null;

    constructor(filename: string) {
        // Synchronous initialisation — we load better-sqlite3 eagerly here.
        // This will throw if the module is unavailable (e.g. Vercel serverless),
        // but that is intentional: LocalAdapter must not be used in production.
        // We use require() via a dynamic trick to keep the top-level import lazy.
        try {
            // Node.js environments: use synchronous require
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Database = require('better-sqlite3');
            this.db = new Database(filename);
            this.db.pragma('journal_mode = WAL');
        } catch (e) {
            throw new Error(
                `LocalAdapter: failed to load better-sqlite3. ` +
                `In production, set DATABASE_URL (Turso) instead of using local SQLite. ` +
                `Original error: ${e}`
            );
        }
    }

    // Keep getBetterSqlite3 available for potential async use
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static _preload = getBetterSqlite3;

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        try {
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                const rows = this.db.prepare(sql).all(params) as Record<string, unknown>[];
                return { rows };
            } else {
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
        if (!params || params.length === 0) {
            this.db.exec(sql);
            return { rows: [], changes: 0, lastInsertRowid: 0 };
        }
        const info = this.db.prepare(sql).run(params);
        return {
            rows: [],
            lastInsertRowid: info.lastInsertRowid,
            changes: info.changes
        };
    }

    async transaction<T>(action: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
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

    getRawDb() {
        return this.db;
    }
}
