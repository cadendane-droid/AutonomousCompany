// TIER B: logic complete, untested against live API (needs a running Postgres).
import { z } from 'zod';
import { DecisionSchema, type Decision, type DecisionKind, type RoleName } from '@atlas/core';
import { query } from './client.js';

export interface LogDecisionInput {
  tenantId: string;
  date: Date;
  role: RoleName | null;
  kind: DecisionKind | null;
  summary: string;
  rationale: string;
  expectedDirection: string | null;
  affectedPages: string[] | null;
  /** Honest boolean, required — no default (Law 9). */
  measurable: boolean;
  measurementPlan: string | null;
  guardrails: unknown;
  /** NOT NULL at the database — Law 2. */
  rollbackRef: string;
  prUrl: string | null;
  embedding?: number[] | null;
}

export async function logDecision(input: LogDecisionInput): Promise<Decision> {
  const rows = await query(
    `insert into decisions (tenant_id, date, role, kind, summary, rationale,
       expected_direction, affected_pages, measurable, measurement_plan,
       guardrails, rollback_ref, pr_url, embedding)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning id, tenant_id, date, role, kind, summary, rationale,
       expected_direction, affected_pages, measurable, measurement_plan,
       guardrails, rollback_ref, pr_url, outcome, reviewed_at`,
    [
      input.tenantId,
      input.date,
      input.role,
      input.kind,
      input.summary,
      input.rationale,
      input.expectedDirection,
      input.affectedPages,
      input.measurable,
      input.measurementPlan,
      JSON.stringify(input.guardrails ?? null),
      input.rollbackRef,
      input.prUrl,
      input.embedding ? `[${input.embedding.join(',')}]` : null,
    ],
  );
  return DecisionSchema.parse(rows[0]);
}

export async function recentDecisions(tenantId: string, limit = 20): Promise<Decision[]> {
  const rows = await query(
    `select id, tenant_id, date, role, kind, summary, rationale, expected_direction,
            affected_pages, measurable, measurement_plan, guardrails, rollback_ref,
            pr_url, outcome, reviewed_at
     from decisions where tenant_id = $1 order by date desc limit $2`,
    [tenantId, limit],
  );
  return z.array(DecisionSchema).parse(rows);
}

/**
 * Semantic recall via pgvector cosine distance (plan §7.4). Agents call this
 * BEFORE proposing — Law 6 made operational. Repeating a failed experiment
 * without new justification is a policy violation.
 */
export async function similarDecisions(
  tenantId: string,
  embedding: number[],
  limit = 5,
): Promise<Array<Decision & { distance: number }>> {
  const rows = await query(
    `select id, tenant_id, date, role, kind, summary, rationale, expected_direction,
            affected_pages, measurable, measurement_plan, guardrails, rollback_ref,
            pr_url, outcome, reviewed_at,
            embedding <=> $2 as distance
     from decisions
     where tenant_id = $1 and embedding is not null
     order by embedding <=> $2
     limit $3`,
    [tenantId, `[${embedding.join(',')}]`, limit],
  );
  return rows.map((r) => ({
    ...DecisionSchema.parse(r),
    distance: Number((r as Record<string, unknown>).distance),
  }));
}

export async function recordOutcome(decisionId: string, outcome: string): Promise<void> {
  await query(`update decisions set outcome = $2, reviewed_at = current_date where id = $1`, [
    decisionId,
    outcome,
  ]);
}
