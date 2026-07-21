// TIER B: logic complete, untested against live API (needs a running Postgres).
//
// The entire job queue: a Postgres table with FOR UPDATE SKIP LOCKED.
// No Redis — at dozens of jobs/day this is a complete queue (plan §6.1).
import { z } from 'zod';
import { JobSchema, type Job, type RoleName } from '@atlas/core';
import { query, withTransaction } from './client.js';

const JobRowSchema = JobSchema;

export interface EnqueueInput {
  tenantId: string | null;
  role: RoleName;
  kind: string;
  payload?: unknown;
  priority?: number;
  runAfter?: Date;
  maxAttempts?: number;
}

export async function enqueue(input: EnqueueInput): Promise<Job> {
  const rows = await query(
    `insert into jobs (tenant_id, role, kind, payload, priority, run_after, max_attempts)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      input.tenantId,
      input.role,
      input.kind,
      JSON.stringify(input.payload ?? null),
      input.priority ?? 5,
      input.runAfter ?? null,
      input.maxAttempts ?? 3,
    ],
  );
  return JobRowSchema.parse(rows[0]);
}

/**
 * Claim up to `limit` jobs for a role. SKIP LOCKED means concurrent workers
 * never double-claim; the transaction marks claimed rows 'running' before
 * releasing the lock.
 */
export async function claim(role: RoleName, limit: number, workerId: string): Promise<Job[]> {
  return withTransaction(async (client) => {
    const result = await client.query(
      `select * from jobs
       where role = $1
         and status in ('pending', 'failed')
         and attempts < max_attempts
         and (run_after is null or run_after <= now())
       order by priority asc, created_at asc
       for update skip locked
       limit $2`,
      [role, limit],
    );
    if (result.rows.length === 0) return [];
    const ids = result.rows.map((r: { id: string }) => r.id);
    const updated = await client.query(
      `update jobs
       set status = 'running', locked_at = now(), locked_by = $2,
           attempts = attempts + 1
       where id = any($1::uuid[])
       returning *`,
      [ids, workerId],
    );
    return z.array(JobRowSchema).parse(updated.rows);
  });
}

export async function complete(jobId: string): Promise<void> {
  await query(
    `update jobs set status = 'done', locked_at = null, locked_by = null where id = $1`,
    [jobId],
  );
}

/**
 * Mark failed. Retries with exponential backoff (2^attempts minutes) until
 * max_attempts, then the job is dead and stays visible for triage.
 */
export async function fail(jobId: string, error: string): Promise<void> {
  await query(
    `update jobs
     set status = case when attempts >= max_attempts then 'dead' else 'failed' end,
         last_error = $2,
         run_after = now() + (interval '1 minute' * power(2, attempts)),
         locked_at = null, locked_by = null
     where id = $1`,
    [jobId, error],
  );
}

/** Refresh the lock so the reaper doesn't reclaim a long-running job. */
export async function heartbeat(jobId: string, workerId: string): Promise<void> {
  await query(`update jobs set locked_at = now() where id = $1 and locked_by = $2`, [
    jobId,
    workerId,
  ]);
}

/** Return stuck 'running' jobs (stale heartbeat) to the queue. */
export async function reapStale(olderThanMinutes = 30): Promise<number> {
  const rows = await query<{ id: string }>(
    `update jobs set status = 'failed', last_error = 'reaped: stale lock',
         locked_at = null, locked_by = null
     where status = 'running' and locked_at < now() - ($1 || ' minutes')::interval
     returning id`,
    [String(olderThanMinutes)],
  );
  return rows.length;
}
