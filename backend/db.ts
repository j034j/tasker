import type { DatabaseAdapter } from './db_adapter.js';
import dotenv from 'dotenv';
dotenv.config();

let _db: DatabaseAdapter;
const hasTursoUrl = process.env.DATABASE_URL?.startsWith('libsql://');
const enableTursoInDev = ['1', 'true', 'yes'].includes(String(process.env.USE_TURSO || '').toLowerCase());
const useTurso = Boolean(
  hasTursoUrl && (process.env.NODE_ENV === 'production' || enableTursoInDev)
);

// Initialization function
export const ensureDB = async () => {
  if (_db) return _db;
  
  if (useTurso) {
    const { TursoAdapter } = await import('./db_turso.js');
    console.log('Using Database URL:', process.env.DATABASE_URL);
    _db = new TursoAdapter(process.env.DATABASE_URL as string, process.env.TURSO_AUTH_TOKEN);
  } else {
    const { LocalAdapter } = await import('./db_local.js');
    console.log('Using Database URL: Local (tasker.db)');
    _db = new LocalAdapter('tasker.db');
  }
  return _db;
};

// Initial trigger (now deferred to initDB or first use)
// await ensureDB();


const splitSqlStatements = (sql: string): string[] =>
  sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => `${statement};`);

export const initDB = async () => {
  await ensureDB();
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
        username TEXT UNIQUE,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        org_id TEXT NOT NULL,
        role TEXT DEFAULT 'member', 
        last_board_id TEXT DEFAULT NULL,
        skills TEXT,
        location TEXT,
        FOREIGN KEY(org_id) REFERENCES organizations(id)
      );

      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        org_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived BOOLEAN DEFAULT 0,
        is_public BOOLEAN DEFAULT 0,
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
        weather_code INTEGER,

        weather_index INTEGER DEFAULT 0,
        funding_factor INTEGER DEFAULT 0,
        skill_availability INTEGER DEFAULT 50,
        admin_override_urgency INTEGER DEFAULT NULL,
        admin_override_priority INTEGER DEFAULT 0,

        priority_score INTEGER DEFAULT 0,
        completed_at DATETIME DEFAULT NULL,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived BOOLEAN DEFAULT 0,
        FOREIGN KEY(column_id) REFERENCES columns(id),
        FOREIGN KEY(assigned_to) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        type TEXT DEFAULT 'info',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS task_override_audit (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        previous_admin_override_urgency INTEGER DEFAULT NULL,
        new_admin_override_urgency INTEGER DEFAULT NULL,
        previous_admin_override_priority INTEGER DEFAULT 0,
        new_admin_override_priority INTEGER DEFAULT 0,
        changed_by TEXT NOT NULL,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(task_id) REFERENCES tasks(id),
        FOREIGN KEY(org_id) REFERENCES organizations(id),
        FOREIGN KEY(changed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS org_role_change_requests (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        requester_user_id TEXT NOT NULL,
        target_user_id TEXT NOT NULL,
        desired_role TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(org_id) REFERENCES organizations(id),
        FOREIGN KEY(requester_user_id) REFERENCES users(id),
        FOREIGN KEY(target_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS weekly_objectives (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        month_key TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        objective_text TEXT NOT NULL,
        updated_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(org_id, month_key, week_number),
        FOREIGN KEY(org_id) REFERENCES organizations(id),
        FOREIGN KEY(updated_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS weekly_objective_audit (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        month_key TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        previous_objective_text TEXT,
        objective_text TEXT NOT NULL,
        changed_by TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(org_id) REFERENCES organizations(id),
        FOREIGN KEY(changed_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        purpose TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        verified_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_recurring_duties (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        title TEXT NOT NULL,
        cadence TEXT NOT NULL,
        day_of_week INTEGER DEFAULT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT,
        notes TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(org_id) REFERENCES organizations(id)
      );
    `;

  // Use a transaction for the initial schema to minimize network round-trips
  try {
    const schemaStatements = splitSqlStatements(schema);
    await db.transaction(async (tx) => {
      for (const statement of schemaStatements) {
        await tx.execute(statement);
      }
    });
  } catch (e) {
    console.error('Schema Init Error:', e);
  }

  // Incremental Migrations (Safe to fail if exist)
  const migrations = [
    'ALTER TABLE tasks ADD COLUMN people_required INTEGER DEFAULT 1',
    'ALTER TABLE tasks ADD COLUMN skills TEXT',
    'ALTER TABLE tasks ADD COLUMN weather_index INTEGER DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN funding_factor INTEGER DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN skill_availability INTEGER DEFAULT 50',
    'ALTER TABLE tasks ADD COLUMN admin_override_urgency INTEGER DEFAULT NULL',
    'ALTER TABLE tasks ADD COLUMN admin_override_priority INTEGER DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN archived BOOLEAN DEFAULT 0',
    'ALTER TABLE boards ADD COLUMN archived BOOLEAN DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN project_duration TEXT',
    'ALTER TABLE tasks ADD COLUMN project_location TEXT',
    'ALTER TABLE tasks ADD COLUMN weather_code INTEGER',
    'ALTER TABLE tasks ADD COLUMN completed_at DATETIME DEFAULT NULL',
    'ALTER TABLE boards ADD COLUMN created_by TEXT',
    'ALTER TABLE boards ADD COLUMN followers TEXT',
    'ALTER TABLE tasks ADD COLUMN interested_users TEXT',
    'ALTER TABLE boards ADD COLUMN is_public BOOLEAN DEFAULT 0',
    'ALTER TABLE users ADD COLUMN last_board_id TEXT DEFAULT NULL',
    'ALTER TABLE users ADD COLUMN phone_number TEXT',
    'ALTER TABLE users ADD COLUMN skills TEXT',
    'ALTER TABLE users ADD COLUMN location TEXT',
    'ALTER TABLE users ADD COLUMN username TEXT',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username)',
    'CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, message TEXT NOT NULL, is_read BOOLEAN DEFAULT 0, type TEXT DEFAULT "info", created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS task_override_audit (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, org_id TEXT NOT NULL, previous_admin_override_urgency INTEGER DEFAULT NULL, new_admin_override_urgency INTEGER DEFAULT NULL, previous_admin_override_priority INTEGER DEFAULT 0, new_admin_override_priority INTEGER DEFAULT 0, changed_by TEXT NOT NULL, changed_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    'CREATE INDEX IF NOT EXISTS idx_task_override_audit_task_changed_at ON task_override_audit(task_id, changed_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_task_override_audit_org_changed_at ON task_override_audit(org_id, changed_at DESC)',
    'CREATE TABLE IF NOT EXISTS password_reset_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at DATETIME NOT NULL, used_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS org_role_change_requests (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, requester_user_id TEXT NOT NULL, target_user_id TEXT NOT NULL, desired_role TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS weekly_objectives (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, month_key TEXT NOT NULL, week_number INTEGER NOT NULL, objective_text TEXT NOT NULL, updated_by TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(org_id, month_key, week_number))',
    'CREATE TABLE IF NOT EXISTS weekly_objective_audit (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, month_key TEXT NOT NULL, week_number INTEGER NOT NULL, previous_objective_text TEXT, objective_text TEXT NOT NULL, changed_by TEXT, changed_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    'CREATE TABLE IF NOT EXISTS email_verification_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL, purpose TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at DATETIME NOT NULL, verified_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    'CREATE INDEX IF NOT EXISTS idx_email_verification_lookup ON email_verification_codes(email, purpose, created_at)',
    'CREATE TABLE IF NOT EXISTS user_recurring_duties (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, org_id TEXT NOT NULL, title TEXT NOT NULL, cadence TEXT NOT NULL, day_of_week INTEGER DEFAULT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, location TEXT, notes TEXT, active BOOLEAN DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    'CREATE INDEX IF NOT EXISTS idx_user_recurring_duties_user ON user_recurring_duties(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_recurring_duties_org ON user_recurring_duties(org_id)',
    `CREATE TABLE IF NOT EXISTS task_invites (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      inviter_user_id TEXT NOT NULL,
      invitee_user_id TEXT NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(task_id) REFERENCES tasks(id),
      FOREIGN KEY(inviter_user_id) REFERENCES users(id),
      FOREIGN KEY(invitee_user_id) REFERENCES users(id)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_task_invites_invitee ON task_invites(invitee_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_task_invites_task ON task_invites(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id)',
    'CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id)',
    'CREATE INDEX IF NOT EXISTS idx_boards_org_id ON boards(org_id)'
  , 'CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, name TEXT NOT NULL, admin_user_id TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(org_id) REFERENCES organizations(id), FOREIGN KEY(admin_user_id) REFERENCES users(id))'
  , 'ALTER TABLE boards ADD COLUMN department_id TEXT'
  , 'CREATE INDEX IF NOT EXISTS idx_boards_department_id ON boards(department_id)'
  , 'CREATE TABLE IF NOT EXISTS task_dependencies (id TEXT PRIMARY KEY, parent_task_id TEXT NOT NULL, child_task_id TEXT NOT NULL, org_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(parent_task_id) REFERENCES tasks(id), FOREIGN KEY(child_task_id) REFERENCES tasks(id), FOREIGN KEY(org_id) REFERENCES organizations(id))'
  , 'CREATE INDEX IF NOT EXISTS idx_task_dependencies_parent ON task_dependencies(parent_task_id)'
  , 'CREATE INDEX IF NOT EXISTS idx_task_dependencies_child ON task_dependencies(child_task_id)'
  ];

  const isDebug = process.env.DEBUG === '1';
  for (const sql of migrations) {
    try {
      await db.execute(sql);
      if (isDebug) console.log('[DB] Migration applied:', sql.slice(0, 60) + '...');
    } catch {
      if (isDebug) console.log('[DB] Migration skipped (may already exist):', sql.slice(0, 60) + '...');
    }
  }
  console.log('Database Initialized.');
};

// Use a proxy or a getter to ensure the exported 'db' always points to the initialized instance
export default new Proxy({} as DatabaseAdapter, {
  get: (_target, prop: keyof DatabaseAdapter) => {
    if (!_db) throw new Error('Database not initialized. Call initDB() or ensureDB() first.');
    return _db[prop];
  }
});
