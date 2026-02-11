import { DatabaseAdapter } from './db_adapter';
import { LocalAdapter } from './db_local';
import { TursoAdapter } from './db_turso';
import dotenv from 'dotenv';
dotenv.config();

let db: DatabaseAdapter;

console.log('Using Database URL:', process.env.DATABASE_URL || 'Local (tasker.db)');

if (process.env.DATABASE_URL?.startsWith('libsql://')) {
  db = new TursoAdapter(process.env.DATABASE_URL, process.env.TURSO_AUTH_TOKEN);
} else {
  db = new LocalAdapter('tasker.db');
}

export const initDB = async () => {
  console.log('Initializing Database...');
  const schema = `
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        org_id TEXT NOT NULL,
        role TEXT DEFAULT 'member', 
        FOREIGN KEY(org_id) REFERENCES organizations(id)
      );

      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        org_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived BOOLEAN DEFAULT 0,
        FOREIGN KEY(org_id) REFERENCES organizations(id)
      );

      CREATE TABLE IF NOT EXISTS columns (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        title TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        FOREIGN KEY(board_id) REFERENCES boards(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT,
        
        urgency INTEGER DEFAULT 50,
        due_date DATETIME,
        weather_sensitive BOOLEAN DEFAULT 0,
        funding_needed INTEGER DEFAULT 0,
        skill_required TEXT,
        project_duration TEXT,
        project_location TEXT,

        people_required INTEGER DEFAULT 1,
        skills TEXT,

        weather_index INTEGER DEFAULT 0,
        funding_factor INTEGER DEFAULT 0,
        skill_availability INTEGER DEFAULT 50,

        priority_score INTEGER DEFAULT 0,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived BOOLEAN DEFAULT 0,
        FOREIGN KEY(column_id) REFERENCES columns(id),
        FOREIGN KEY(assigned_to) REFERENCES users(id)
      );
    `;

  // Attempt to run schema
  // Note: LocalAdapter wraps better-sqlite3 which handles multi-statement strings.
  // Turso might expect single statements. For safety, let's simple execute.
  try {
    await db.execute(schema);
  } catch (e) {
    console.error("Schema Init Error (might be multi-statement issue, ignoring if tables exist):", e);
  }

  // Incremental Migrations (Safe to fail if exist)
  const migrations = [
    'ALTER TABLE tasks ADD COLUMN people_required INTEGER DEFAULT 1',
    'ALTER TABLE tasks ADD COLUMN skills TEXT',
    'ALTER TABLE tasks ADD COLUMN weather_index INTEGER DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN funding_factor INTEGER DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN skill_availability INTEGER DEFAULT 50',
    'ALTER TABLE tasks ADD COLUMN archived BOOLEAN DEFAULT 0',
    'ALTER TABLE boards ADD COLUMN archived BOOLEAN DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN project_duration TEXT',
    'ALTER TABLE tasks ADD COLUMN project_location TEXT'
  ];

  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch (e) {
      // Ignore Duplicate Column errors
    }
  }
  console.log('Database Initialized.');
};

export default db;
