
import { createClient, Client } from '@libsql/client';
import { DatabaseAdapter, QueryResult } from './db_adapter';

export class TursoAdapter implements DatabaseAdapter {
    private client: Client;

    constructor(url: string, authToken?: string) {
        this.client = createClient({
            url,
            authToken
        });
    }

    async query(sql: string, params: any[] = []): Promise<QueryResult> {
        const rs = await this.client.execute({ sql, args: params });
        return {
            rows: rs.rows,
            lastInsertRowid: rs.lastInsertRowid,
            changes: rs.rowsAffected
        };
    }

    async execute(sql: string, params: any[] = []): Promise<QueryResult> {
        const rs = await this.client.execute({ sql, args: params });
        return {
            rows: rs.rows,
            lastInsertRowid: rs.lastInsertRowid,
            changes: rs.rowsAffected
        };
    }

    async transaction<T>(action: (db: DatabaseAdapter) => Promise<T>): Promise<T> {
        const tx = await this.client.transaction();
        try {
            const txAdapter: DatabaseAdapter = {
                query: async (sql, params) => {
                    const rs = await tx.execute({ sql, args: params });
                    return { rows: rs.rows, changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
                },
                execute: async (sql, params) => {
                    const rs = await tx.execute({ sql, args: params });
                    return { rows: rs.rows, changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
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
