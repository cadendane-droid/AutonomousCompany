import { describe, expect, it } from 'vitest';
import { applyBudget, tierForTask, TASK_TIER_MAP } from './router.js';
import { costUsd, MODEL_CONFIG } from './models.js';

describe('tierForTask', () => {
  it('routes per the plan §6.2 table', () => {
    expect(tierForTask('broken-link-detection')).toBe('rules');
    expect(tierForTask('anomaly-detection')).toBe('rules');
    expect(tierForTask('content-quality-scoring')).toBe('cloud-small');
    expect(tierForTask('article-drafting')).toBe('cloud-capable');
    expect(tierForTask('experiment-design')).toBe('reasoning');
    expect(tierForTask('roadmap-synthesis')).toBe('reasoning');
  });

  it('refuses unknown task kinds instead of defaulting to an expensive model', () => {
    expect(() => tierForTask('mystery-task')).toThrow(/unknown task kind/);
  });

  it('every mapped tier has a model config', () => {
    for (const tier of Object.values(TASK_TIER_MAP)) {
      expect(MODEL_CONFIG[tier]).toBeDefined();
    }
  });
});

describe('applyBudget', () => {
  it('passes through under 80% of budget', () => {
    const decision = applyBudget('reasoning', 50, 100);
    expect(decision.tier).toBe('reasoning');
    expect(decision.degraded).toBe(false);
    expect(decision.blocked).toBe(false);
  });

  it('degrades one step at 80–90%', () => {
    expect(applyBudget('reasoning', 85, 100).tier).toBe('cloud-capable');
    expect(applyBudget('cloud-capable', 85, 100).tier).toBe('cloud-small');
  });

  it('degrades two steps at 90–100%', () => {
    expect(applyBudget('reasoning', 95, 100).tier).toBe('cloud-small');
  });

  it('never degrades below local — a task that needs a model still needs one', () => {
    const decision = applyBudget('cloud-small', 95, 100);
    expect(decision.tier).toBe('local');
    expect(decision.blocked).toBe(false);
  });

  it('hard stops at 100% of budget', () => {
    const decision = applyBudget('cloud-small', 100, 100);
    expect(decision.blocked).toBe(true);
  });

  it('rules tier is never budget-limited (it is free)', () => {
    const decision = applyBudget('rules', 500, 100);
    expect(decision.blocked).toBe(false);
    expect(decision.tier).toBe('rules');
  });

  it('rejects a nonsensical budget', () => {
    expect(() => applyBudget('reasoning', 10, 0)).toThrow(RangeError);
  });
});

describe('costUsd', () => {
  it('computes cost from the pricing table', () => {
    // reasoning = $5/MTok in, $25/MTok out
    expect(costUsd('reasoning', 1_000_000, 1_000_000)).toBeCloseTo(30, 6);
    expect(costUsd('rules', 1_000_000, 1_000_000)).toBe(0);
  });
});
