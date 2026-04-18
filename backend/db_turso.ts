
import { createClient } from '@libsql/client';
import type { Client, InValue } from '@libsql/client';
import type { DatabaseAdapter, QueryResult } from './db_adapter.js';

export class TursoAdapter implements DatabaseAdapter {
    private client: Client;

    constructor(url: string, authToken?: string) {
        this.client = createClient({
            url,
            authToken
        });
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        const rs = await this.client.execute({ sql, args: params as InValue[] });
        return {
            rows: rs.rows as Record<string, unknown>[],
            lastInsertRowid: rs.lastInsertRowid,
            changes: rs.rowsAffected
        };
    }

    async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
        const rs = await this.client.execute({ sql, args: params as InValue[] });
        return {
            rows: rs.rows as Record<string, unknown>[],
            lastInsertRowid: rs.lastInsertRowid,
            changes: rs.rowsAffected
        };
    }

    async transaction<T>(action: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
        const tx = await this.client.transaction();
        try {
            const txAdapter: DatabaseAdapter = {
                query: async (sql: string, params?: unknown[]) => {
                    const rs = await tx.execute({ sql, args: params as InValue[] | undefined });
                    return { rows: rs.rows as Record<string, unknown>[], changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
                },
                execute: async (sql: string, params?: unknown[]) => {
                    const rs = await tx.execute({ sql, args: params as InValue[] | undefined });
                    return { rows: rs.rows as Record<string, unknown>[], changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
                },
                transaction: async <U>(innerAction: (db: DatabaseAdapter) => Promise<U>): Promise<U> => {
                    // Nested transactions not fully supported in this shim, just pass through or use savepoints later
                    return await innerAction(txAdapter);
                }
            };

            const result = await action(txAdapter);
            await tx.commit();
            return result;
        } catch (e) {
            await tx.rollback();
            throw e;
        } finally {
            tx.close();
        }
    }
}
