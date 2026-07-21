// TIER A: fully working, no external dependencies. Unit tested.
//
// The AI router (spec §7 principle 1, plan §6.2): hard-coded rules →
// statistics → local → cloud → reasoning. Task→tier mapping is a CONFIG
// TABLE, not a switch statement. Every routing decision is logged (client.ts
// writes agent_runs) so the monthly over-served-task review has data.
import type { ModelTier } from '@atlas/core';

/**
 * Task kinds → tier, transcribed from plan §6.2 and extended with the task
 * kinds this repo actually enqueues. Unknown task kinds are refused loudly —
 * silently defaulting to an expensive tier is how costs creep.
 */
export const TASK_TIER_MAP: Record<string, ModelTier> = {
  // deterministic — never a model
  'broken-link-detection': 'rules',
  'sitemap-regeneration': 'rules',
  'metric-aggregation': 'rules',
  'anomaly-detection': 'rules', // z-score, packages/stats
  'frontmatter-validation': 'rules',
  'health-check': 'rules',

  // similarity / embeddings
  'internal-link-suggestions': 'local',
  'semantic-recall': 'local',

  // cheap model work
  'content-quality-scoring': 'cloud-small',
  'brand-voice-check': 'cloud-small',
  summarization: 'cloud-small',

  // generation quality matters
  'article-drafting': 'cloud-capable',
  'article-outline': 'cloud-capable',
  'content-refresh': 'cloud-capable',
  'fact-check': 'cloud-capable',

  // judgment
  'experiment-design': 'reasoning',
  'roadmap-synthesis': 'reasoning',
  'anomaly-investigation': 'reasoning',
};

export function tierForTask(taskKind: string): ModelTier {
  const tier = TASK_TIER_MAP[taskKind];
  if (!tier) {
    throw new Error(
      `Router: unknown task kind "${taskKind}". Add it to TASK_TIER_MAP with an ` +
        `explicit tier — tasks are never silently routed to a default model.`,
    );
  }
  return tier;
}

/** Cheaper-tier ordering used for budget degradation. */
const DEGRADE_ORDER: ModelTier[] = ['reasoning', 'cloud-capable', 'cloud-small', 'local', 'rules'];

export interface BudgetDecision {
  tier: ModelTier;
  degraded: boolean;
  /** True when the budget hard-stop forbids ANY model call. */
  blocked: boolean;
  reason: string;
}

/**
 * Budget-aware tier resolution (plan §13: "agent costs creep past the site's
 * revenue"). Pure function so it is trivially testable:
 *   < 80% of budget  → requested tier
 *   80–100%          → degrade one step per 10% band over 80%
 *   >= 100%          → hard stop for anything that costs money
 */
export function applyBudget(
  requested: ModelTier,
  monthSpendUsd: number,
  monthlyBudgetUsd: number,
): BudgetDecision {
  if (monthlyBudgetUsd <= 0) {
    throw new RangeError(`monthlyBudgetUsd must be > 0, got ${monthlyBudgetUsd}`);
  }
  if (requested === 'rules') {
    return { tier: 'rules', degraded: false, blocked: false, reason: 'rules tier is free' };
  }

  const ratio = monthSpendUsd / monthlyBudgetUsd;
  if (ratio >= 1) {
    return {
      tier: requested,
      degraded: false,
      blocked: true,
      reason: `monthly LLM budget exhausted ($${monthSpendUsd.toFixed(2)} / $${monthlyBudgetUsd}); hard stop`,
    };
  }
  if (ratio < 0.8) {
    return { tier: requested, degraded: false, blocked: false, reason: 'within budget' };
  }

  // 80–90% → one step down; 90–100% → two steps down.
  const steps = ratio < 0.9 ? 1 : 2;
  const currentIndex = DEGRADE_ORDER.indexOf(requested);
  // Never degrade below cloud-small→local; a task that needs a model still
  // needs one. (rules is not a degradation target.)
  const floor = DEGRADE_ORDER.indexOf('local');
  const newIndex = Math.min(currentIndex + steps, floor);
  const tier = DEGRADE_ORDER[newIndex]!;
  return {
    tier,
    degraded: tier !== requested,
    blocked: false,
    reason: `budget at ${(ratio * 100).toFixed(0)}%; degraded ${requested} → ${tier}`,
  };
}
