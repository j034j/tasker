
export interface QueryResult {
    rows: any[];
    // For INSERT/UPDATE/DELETE results
    lastInsertRowid?: bigint | number;
    changes?: number;
}

export interface DatabaseAdapter {
    query(sql: string, params?: any[]): Promise<QueryResult>;
    execute(sql: string, params?: any[]): Promise<QueryResult>;
    transaction<T>(action: (db: DatabaseAdapter) => Promise<T>): Promise<T>;
}
