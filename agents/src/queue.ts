// TIER A: thin wrapper over the @atlas/db SKIP LOCKED queue with this
// worker's identity attached. All queue semantics live in packages/db.
import { hostname } from 'node:os';
import { claim, complete, fail, heartbeat, reapStale, type EnqueueInput, enqueue } from '@atlas/db';
import type { Job, RoleName } from '@atlas/core';

export const WORKER_ID = `${hostname()}-${process.pid}`;

export async function claimJobs(role: RoleName, limit: number): Promise<Job[]> {
  return claim(role, limit, WORKER_ID);
}

export async function completeJob(job: Job): Promise<void> {
  await complete(job.id);
}

export async function failJob(job: Job, error: string): Promise<void> {
  await fail(job.id, error);
}

export async function heartbeatJob(job: Job): Promise<void> {
  await heartbeat(job.id, WORKER_ID);
}

export async function reapStaleJobs(): Promise<number> {
  return reapStale();
}

export async function enqueueJob(input: EnqueueInput): Promise<Job> {
  return enqueue(input);
}
