// TIER B: logic complete, untested against live API (needs a running Postgres).
import type { ModelTier, RoleName } from '@atlas/core';
import { query } from './client.js';

export interface RecordAgentRunInput {
  jobId: string | null;
  tenantId: string | null;
  role: RoleName | null;
  modelTier: ModelTier | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  outcome: string | null;
  error?: string | null;
}

export async function recordAgentRun(input: RecordAgentRunInput): Promise<void> {
  await query(
    `insert into agent_runs (job_id, tenant_id, role, model_tier, model,
       input_tokens, output_tokens, cost_usd, duration_ms, outcome, error)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      input.jobId,
      input.tenantId,
      input.role,
      input.modelTier,
      input.model,
      input.inputTokens,
      input.outputTokens,
      input.costUsd,
      input.durationMs,
      input.outcome,
      input.error ?? null,
    ],
  );
}

/** LLM spend this calendar month — the budget cap reads this. */
export async function monthSpendUsd(): Promise<number> {
  const rows = await query<{ spend: string | null }>(
    `select sum(cost_usd)::text as spend from agent_runs
     where created_at >= date_trunc('month', now())`,
  );
  return Number(rows[0]?.spend ?? 0);
}
