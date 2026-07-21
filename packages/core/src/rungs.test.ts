import { describe, expect, it } from 'vitest';
import { RUNG_DEFINITIONS } from './rungs.js';
import { FrontmatterSchema } from './frontmatter.js';
import { ProposalSchema } from './proposal.js';

describe('rung ladder data', () => {
  it('thresholds are strictly increasing', () => {
    expect(RUNG_DEFINITIONS[0].minMonthlySessions).toBe(0);
    expect(RUNG_DEFINITIONS[1].minMonthlySessions).toBe(1000);
    expect(RUNG_DEFINITIONS[2].minMonthlySessions).toBe(10_000);
    expect(RUNG_DEFINITIONS[3].minMonthlySessions).toBe(100_000);
  });

  it('Rung 0 permits no experiments — log, do not test', () => {
    expect(RUNG_DEFINITIONS[0].maxConcurrentExperiments).toBe(0);
    expect(RUNG_DEFINITIONS[0].allowedMethods).toEqual(['decision-log']);
    expect(RUNG_DEFINITIONS[0].promotableTiers).toEqual(['decision']);
  });

  it('concurrency caps match policy rules.yml (0/1/3/10)', () => {
    expect(
      ([0, 1, 2, 3] as const).map((r) => RUNG_DEFINITIONS[r].maxConcurrentExperiments),
    ).toEqual([0, 1, 3, 10]);
  });

  it('principle promotion is unreachable below Rung 2', () => {
    expect(RUNG_DEFINITIONS[1].promotableTiers).not.toContain('principle');
    expect(RUNG_DEFINITIONS[2].promotableTiers).toContain('principle');
  });
});

describe('frontmatter schema', () => {
  const valid = {
    title: 'Best PLACEHOLDER_NICHE Widgets 2026',
    slug: 'best-widgets',
    type: 'buying-guide',
    cluster: 'widgets',
    published: '2026-07-21',
    updated: '2026-07-21',
    monetized: true,
    atlas: {
      tenant: 'tenant-alpha',
      quality_score: null,
      cohort: null,
      protected: false,
      last_decision_id: null,
    },
  };

  it('accepts the plan §3.1 shape', () => {
    expect(FrontmatterSchema.parse(valid).atlas.tenant).toBe('tenant-alpha');
  });

  it('rejects a missing atlas block', () => {
    const { atlas: _atlas, ...withoutAtlas } = valid;
    expect(FrontmatterSchema.safeParse(withoutAtlas).success).toBe(false);
  });

  it('rejects an unknown page type', () => {
    expect(FrontmatterSchema.safeParse({ ...valid, type: 'listicle' }).success).toBe(false);
  });
});

describe('proposal schema', () => {
  it('accepts an honest unmeasurable Rung 0 proposal', () => {
    const result = ProposalSchema.safeParse({
      proposal: 'Add comparison table to 4 buying guides',
      rationale: 'Scroll-depth data: 62% never reach current table position',
      expected_direction: 'Increase in affiliate click rate',
      measurable: false,
      measurable_note: 'Current traffic 340 sessions/month. Logged as Tier 1 decision.',
      guardrails: ['bounce rate', 'LCP'],
      rollback: { method: 'Revert commit', condition: 'LCP regression > 200ms' },
      risk: 'low',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a proposal without a rollback condition (Law 2)', () => {
    const result = ProposalSchema.safeParse({
      proposal: 'x',
      rationale: 'y',
      expected_direction: 'up',
      measurable: false,
      guardrails: ['bounce rate'],
      risk: 'low',
    });
    expect(result.success).toBe(false);
  });
});
