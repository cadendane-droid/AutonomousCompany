// TIER A logic over a TIER B data layer: the loop itself is deterministic and
// unit tested; the queries beneath it are untested against a live Postgres.
//
// The runtime (plan §6.1). Deliberately boring: claim jobs with SKIP LOCKED,
// dispatch to a role handler, record the run, retry on failure, respect freeze.
import { randomUUID } from 'node:crypto';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  claim,
  complete,
  fail,
  heartbeat,
  isFrozen,
  listTenants,
  recordAgentRun,
  reapStale,
} from '@atlas/db';
import { RoleNameSchema, type Job, type RoleName, type Tenant } from '@atlas/core';
import { ROLES_ALLOWED_WHILE_FROZEN, ROLE_HANDLERS } from './roles/index.js';
import type { JobContext } from './roles/types.js';

export interface WorkerOptions {
  /** Roles this worker drains. Defaults to all five. */
  roles?: RoleName[];
  /** Max jobs claimed per role per pass. */
  batchSize?: number;
  /** Stop after this many passes. Omit to run until drained (CI/cron mode). */
  maxPasses?: number;
  /** Milliseconds between heartbeats on a running job. */
  heartbeatMs?: number;
  workerId?: string;
}

export interface PassResult {
  claimed: number;
  succeeded: number;
  failed: number;
  skippedFrozen: number;
}

/** Heartbeat a job until the returned function is called. */
function startHeartbeat(jobId: string, workerId: string, intervalMs: number): () => void {
  const timer = setInterval(() => {
    // A failing heartbeat must not kill the job; the reaper is the backstop.
    void heartbeat(jobId, workerId).catch(() => undefined);
  }, intervalMs);
  return () => clearInterval(timer);
}

async function runJob(job: Job, tenant: Tenant, workerId: string, heartbeatMs: number): Promise<void> {
  const role = RoleNameSchema.parse(job.role);
  const ctx: JobContext = { job, tenant };
  const startedAt = Date.now();
  const stopHeartbeat = startHeartbeat(job.id, workerId, heartbeatMs);

  try {
    const handler = ROLE_HANDLERS[role][job.kind];
    if (!handler) {
      // An unroutable job is a failure, not a silent skip — a job kind nobody
      // handles is a bug, and swallowing it hides the bug forever. This throw
      // must happen inside the try so it takes the same recorded-and-backed-off
      // path as any other failure, rather than parking the job in 'running'.
      throw new Error(`no handler for role '${role}' kind '${job.kind}'`);
    }
    const outcome = await handler(ctx);
    await recordAgentRun({
      jobId: job.id,
      tenantId: tenant.id,
      role,
      // The dispatch itself costs nothing; individual model calls inside the
      // handler record their own agent_runs rows with real tokens and cost.
      modelTier: 'rules',
      model: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: Date.now() - startedAt,
      outcome,
    });
    await complete(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordAgentRun({
      jobId: job.id,
      tenantId: tenant.id,
      role,
      modelTier: 'rules',
      model: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: Date.now() - startedAt,
      outcome: 'error',
      error: message,
    });
    // fail() applies exponential backoff and marks the job dead past
    // max_attempts, leaving it visible for triage rather than deleting it.
    await fail(job.id, message);
    throw err;
  } finally {
    stopHeartbeat();
  }
}

/** One drain pass across the configured roles. Returns what it did. */
export async function runPass(options: WorkerOptions = {}): Promise<PassResult> {
  const roles = options.roles ?? (Object.keys(ROLE_HANDLERS) as RoleName[]);
  const batchSize = options.batchSize ?? 5;
  const heartbeatMs = options.heartbeatMs ?? 30_000;
  const workerId = options.workerId ?? `worker-${randomUUID()}`;

  const result: PassResult = { claimed: 0, succeeded: 0, failed: 0, skippedFrozen: 0 };

  const tenants = await listTenants();
  const tenantsById = new Map(tenants.map((t) => [t.id, t]));

  // Freeze is evaluated per tenant, once per pass, from the database — never
  // from anything a job payload carries.
  const frozen = new Map<string, boolean>();
  for (const tenant of tenants) {
    frozen.set(tenant.id, await isFrozen(tenant.id));
  }

  for (const role of roles) {
    const jobs = await claim(role, batchSize, workerId);
    result.claimed += jobs.length;

    for (const job of jobs) {
      const tenant = job.tenant_id ? tenantsById.get(job.tenant_id) : undefined;
      if (!tenant) {
        result.failed += 1;
        await fail(job.id, `job references unknown tenant ${job.tenant_id ?? 'null'}`);
        continue;
      }

      if (frozen.get(tenant.id) === true && !ROLES_ALLOWED_WHILE_FROZEN.includes(role)) {
        // Return it to the queue rather than failing it — the work is still
        // wanted, just not while frozen. Only a human clears a freeze (§5.4).
        result.skippedFrozen += 1;
        await fail(job.id, `system frozen for tenant ${tenant.slug}; deferred`);
        continue;
      }

      try {
        await runJob(job, tenant, workerId, heartbeatMs);
        result.succeeded += 1;
      } catch {
        // runJob already recorded the run and applied backoff.
        result.failed += 1;
      }
    }
  }

  return result;
}

/**
 * Drain the queue. Runs passes until one claims nothing, or until maxPasses.
 * Invoked by the agent-worker workflow on cron and manual dispatch; it exits
 * rather than running forever, so a stuck worker cannot outlive its schedule.
 */
export async function drain(options: WorkerOptions = {}): Promise<PassResult> {
  const total: PassResult = { claimed: 0, succeeded: 0, failed: 0, skippedFrozen: 0 };
  const maxPasses = options.maxPasses ?? 20;

  await reapStale();

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const result = await runPass(options);
    total.claimed += result.claimed;
    total.succeeded += result.succeeded;
    total.failed += result.failed;
    total.skippedFrozen += result.skippedFrozen;
    if (result.claimed === 0) break;
  }

  return total;
}

/** CLI: pnpm --filter @atlas/agents worker [--role builder] [--batch 5] */
async function main(): Promise<void> {
  const roleArg = argv[argv.indexOf('--role') + 1];
  const batchArg = argv[argv.indexOf('--batch') + 1];

  const options: WorkerOptions = {};
  if (argv.includes('--role') && roleArg) options.roles = [RoleNameSchema.parse(roleArg)];
  if (argv.includes('--batch') && batchArg) options.batchSize = Number(batchArg);

  const result = await drain(options);
  console.log(
    `drained: ${result.claimed} claimed, ${result.succeeded} succeeded, ` +
      `${result.failed} failed, ${result.skippedFrozen} deferred (frozen)`,
  );

  const { closePool } = await import('@atlas/db');
  await closePool();

  // A worker that only produced failures should not report success to cron.
  if (result.failed > 0 && result.succeeded === 0) process.exitCode = 1;
}

if (argv[1] && fileURLToPath(import.meta.url) === argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
