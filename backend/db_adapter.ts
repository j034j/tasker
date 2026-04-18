
export interface QueryResult {
    rows: Record<string, unknown>[];
    // For INSERT/UPDATE/DELETE results
    lastInsertRowid?: bigint | number;
    changes?: number;
}

export interface DatabaseAdapter {
    query(sql: string, params?: unknown[]): Promise<QueryResult>;
    execute(sql: string, params?: unknown[]): Promise<QueryResult>;
    transaction<T>(action: (db: DatabaseAdapter) => Promise<T>): Promise<T>;
}
