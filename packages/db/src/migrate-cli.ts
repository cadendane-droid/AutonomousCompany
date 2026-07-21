// TIER B: runs real DDL against DATABASE_URL; untested against a live Postgres.
// CLI entry: pnpm db:migrate — applies db/migrations against DATABASE_URL.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { closePool } from './client.js';
import { runMigrations } from './migrate.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../../db/migrations');

const result = await runMigrations(migrationsDir);
for (const f of result.applied) console.log(`applied  ${f}`);
console.log(`${result.applied.length} applied, ${result.skipped.length} already applied`);
await closePool();