import type { Job, Tenant } from '@atlas/core';

export interface JobContext {
  job: Job;
  tenant: Tenant;
}

/** Returns a short outcome summary recorded on agent_runs. */
export type JobHandler = (ctx: JobContext) => Promise<string>;

export type RoleHandlers = Record<string, JobHandler>;
