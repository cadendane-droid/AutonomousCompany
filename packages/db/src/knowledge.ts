// TIER B: logic complete, untested against live API (needs a running Postgres).
//
// Tiered knowledge base (spec §8). Promotion is an explicit act — there is
// deliberately no automatic promoter here; an automatic promoter will, given
// enough runs, promote noise (plan §9.3).
import type { KnowledgeScope, KnowledgeTier } from '@atlas/core';
import { query } from './client.js';

export interface KnowledgeRecord {
  id: string;
  tenant_id: string | null;
  scope: KnowledgeScope;
  tier: KnowledgeTier;
  claim: string;
  evidence: string;
  strength: string | null;
  effect_summary: string | null;
  confidence_interval: string | null;
  boundary: string | null;
  tags: string[];
  review_at: string | null;
}

export async function addKnowledge(input: {
  tenantId: string | null;
  scope: KnowledgeScope;
  tier: KnowledgeTier;
  claim: string;
  evidence: string;
  strength?: string;
  effectSummary?: string;
  /** Only legal on tier='principle'; the DB CHECK enforces it (Law 9). */
  confidenceInterval?: string;
  boundary?: string;
  tags?: string[];
  sourceDecisionIds?: string[];
  embedding?: number[];
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into knowledge (tenant_id, scope, tier, claim, evidence, strength,
       effect_summary, confidence_interval, boundary, tags, source_decision_ids, embedding)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
    [
      input.tenantId,
      input.scope,
      input.tier,
      input.claim,
      input.evidence,
      input.strength ?? null,
      input.effectSummary ?? null,
      input.confidenceInterval ?? null,
      input.boundary ?? null,
      input.tags ?? [],
      input.sourceDecisionIds ?? [],
      input.embedding ? `[${input.embedding.join(',')}]` : null,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('addKnowledge: insert returned no id');
  return id;
}

/** Agents query before proposing (spec §8 rule 4). */
export async function searchKnowledge(
  tenantId: string,
  embedding: number[],
  limit = 5,
): Promise<KnowledgeRecord[]> {
  const rows = await query(
    `select id, tenant_id, scope, tier, claim, evidence, strength, effect_summary,
            confidence_interval, boundary, tags, review_at::text
     from knowledge
     where (tenant_id = $1 or scope = 'platform') and embedding is not null
     order by embedding <=> $2
     limit $3`,
    [tenantId, `[${embedding.join(',')}]`, limit],
  );
  return rows as unknown as KnowledgeRecord[];
}
