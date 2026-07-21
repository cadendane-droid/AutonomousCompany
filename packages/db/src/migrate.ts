// TIER B: logic complete, untested against live API (needs a running Postgres).
//
// Plain-Node migration runner. No Supabase CLI dependency. Numbered,
// forward-only files in db/migrations, applied in filename order inside a
// transaction each, tracked in schema_migrations.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPool } from './client.js';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(migrationsDir: string): Promise<MigrationResult> {
  const pool = getPool();
  await pool.query(`
    create table if not exists schema_migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )`);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  const appliedRows = await pool.query<{ filename: string }>(
    'select filename from schema_migrations',
  );
  const alreadyApplied = new Set(appliedRows.rows.map((r) => r.filename));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (filename) values ($1)', [file]);
      await client.query('commit');
      applied.push(file);
    } catch (err) {
      await client.query('rollback');
      throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
}
