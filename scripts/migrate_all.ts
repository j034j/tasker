import fs from 'fs';
import path from 'path';
import db from '../backend/db.js';

async function ensureMigrationsTable() {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS migrations_applied (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) {
    console.error('Failed to ensure migrations table:', e);
    throw e;
  }
}

async function getAppliedMigrations() {
  try {
    const res = await db.query('SELECT filename FROM migrations_applied');
    return new Set(res.rows.map((r: any) => r.filename));
  } catch (e) {
    console.error('Failed to get applied migrations:', e);
    return new Set();
  }
}

async function applyMigration(filePath: string, filename: string) {
  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (!sql) return;
  try {
    await db.transaction(async (tx) => {
      // Run the migration SQL (can be single statement)
      await tx.execute(sql);
      await tx.execute('INSERT INTO migrations_applied (id, filename) VALUES (?, ?)', [cryptoId(), filename]);
    });
    console.log('Applied migration:', filename);
  } catch (e) {
      const msg = String((e as any)?.message || '');
      // Idempotent handling: mark migration as applied if it failed due to already-existing column/table/index
      if (msg.includes('duplicate column') || msg.includes('duplicate column name') || msg.includes('already exists') || msg.includes('is not unique')) {
        console.log('Migration appears already applied (idempotent error). Marking as applied:', filename);
        try {
          await db.execute('INSERT INTO migrations_applied (id, filename) VALUES (?, ?)', [cryptoId(), filename]);
        } catch (markErr) {
          console.warn('Failed to record migration as applied:', markErr);
        }
        return;
      }
      console.error('Migration failed:', filename, e);
      throw e;
  }
}

function cryptoId() {
  return (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 36);
}

async function run() {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('No migrations directory found at', migrationsDir);
    process.exit(1);
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) {
      console.log('Skipping already applied:', file);
      continue;
    }
    const filePath = path.join(migrationsDir, file);
    await applyMigration(filePath, file);
  }

  console.log('Migrations complete.');
}

run().catch((e) => {
  console.error('Migration runner failed:', e);
  process.exit(1);
});
