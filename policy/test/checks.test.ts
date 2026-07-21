import { describe, expect, it } from 'vitest';
import { parseDiff } from '../src/diff.js';
import { blastRadius } from '../src/checks/blast-radius.js';
import { protectedPaths } from '../src/checks/protected-paths.js';
import { frontmatter } from '../src/checks/frontmatter.js';
import { disclosure } from '../src/checks/disclosure.js';
import { internalLinks } from '../src/checks/internal-links.js';
import { schemaMarkup } from '../src/checks/schema-markup.js';
import { freezeState } from '../src/checks/freeze-state.js';
import { concurrency } from '../src/checks/concurrency.js';
import { powerCheck } from '../src/checks/power-check.js';
import { rollbackDeclared } from '../src/checks/rollback-declared.js';
import { runPolicy } from '../src/index.js';
import { makeCtx, makeDiff, VALID_PROPOSAL } from './helpers.js';
import type { ExperimentPlan } from '@atlas/core';

const GOOD = 'site/src/content/tenant-alpha/guides/good-article.md';
const BAD = 'site/src/content/tenant-alpha/guides/bad-article.md';

describe('blast-radius', () => {
  it('passes a small diff', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: GOOD }])) });
    expect((await blastRadius.run(ctx)).status).toBe('pass');
  });

  it('fails on too many files', async () => {
    const files = Array.from({ length: 6 }, (_, i) => ({ path: `site/src/f${i}.ts` }));
    const ctx = makeCtx({ diff: parseDiff(makeDiff(files)) });
    const result = await blastRadius.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/files changed/);
  });

  it('fails on too many changed lines', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: 'a.ts', lines: 900 }])) });
    expect((await blastRadius.run(ctx)).status).toBe('fail');
  });

  it('fails on more than one deletion', async () => {
    const ctx = makeCtx({
      diff: parseDiff(
        makeDiff([
          { path: 'a.md', status: 'deleted' },
          { path: 'b.md', status: 'deleted' },
        ]),
      ),
    });
    expect((await blastRadius.run(ctx)).status).toBe('fail');
  });

  it('fails when weekly new-page budget is exhausted', async () => {
    const ctx = makeCtx({
      diff: parseDiff(makeDiff([{ path: GOOD, status: 'added' }])),
      state: { ...makeCtx().state, new_pages_last_7d: 8 },
    });
    const result = await blastRadius.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/week/);
  });
});

describe('protected-paths', () => {
  it('fails on a brand file without human approval', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: 'brand/rules.md' }])) });
    expect((await protectedPaths.run(ctx)).status).toBe('fail');
  });

  it('passes the same diff WITH human approval (GitHub review, not PR content)', async () => {
    const ctx = makeCtx({
      diff: parseDiff(makeDiff([{ path: 'brand/rules.md' }])),
      state: { ...makeCtx().state, human_approved: true },
    });
    expect((await protectedPaths.run(ctx)).status).toBe('pass');
  });

  it('protects the policy engine itself', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: 'policy/rules.yml' }])) });
    expect((await protectedPaths.run(ctx)).status).toBe('fail');
  });

  it('passes unrelated paths', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: GOOD }])) });
    expect((await protectedPaths.run(ctx)).status).toBe('pass');
  });
});

describe('frontmatter', () => {
  it('passes a complete content file', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: GOOD }])) });
    expect((await frontmatter.run(ctx)).status).toBe('pass');
  });

  it('fails a file missing cluster and Sources', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: BAD }])) });
    const result = await frontmatter.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/cluster/);
    expect(result.message).toMatch(/Sources/);
  });

  it('is not applicable when no content changed', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: 'packages/core/src/x.ts' }])) });
    expect((await frontmatter.run(ctx)).status).toBe('not-applicable');
  });
});

describe('disclosure', () => {
  it('passes an affiliate page declared monetized', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: GOOD }])) });
    expect((await disclosure.run(ctx)).status).toBe('pass');
  });

  it('fails affiliate links on a non-monetized page', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: BAD }])) });
    const result = await disclosure.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/monetized/);
  });
});

describe('internal-links', () => {
  it('passes when links resolve', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: GOOD }])) });
    expect((await internalLinks.run(ctx)).status).toBe('pass');
  });

  it('fails a broken internal link', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: BAD }])) });
    const result = await internalLinks.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/does-not-exist/);
  });
});

describe('schema-markup', () => {
  it('passes valid frontmatter-derived JSON-LD', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: GOOD }])) });
    expect((await schemaMarkup.run(ctx)).status).toBe('pass');
  });
});

describe('freeze-state', () => {
  it('passes when not frozen', async () => {
    expect((await freezeState.run(makeCtx())).status).toBe('pass');
  });

  it('fails everything when frozen', async () => {
    const ctx = makeCtx({
      state: { ...makeCtx().state, frozen: true, freeze_reason: 'algorithm update 2026-07-20' },
    });
    const result = await freezeState.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/FROZEN/);
  });
});

const POWERED_EXPERIMENT: ExperimentPlan = {
  method: 'ab-test',
  primary_metric: 'affiliate conversion rate',
  baseline_rate: 0.05,
  mde_relative: 0.5,
  traffic_per_arm_per_day: 200,
  planned_duration_days: 14,
  stopping_rule: 'fixed horizon at 14 days, no peeking',
};

describe('concurrency', () => {
  it('not applicable without an experiment', async () => {
    expect((await concurrency.run(makeCtx())).status).toBe('not-applicable');
  });

  it('fails any experiment at rung 0 — log, do not test', async () => {
    const ctx = makeCtx({
      proposal: { ...VALID_PROPOSAL, measurable: true, experiment: POWERED_EXPERIMENT },
    });
    const result = await concurrency.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/Rung 0/);
  });

  it('fails when the rung cap is already reached', async () => {
    const ctx = makeCtx({
      proposal: { ...VALID_PROPOSAL, measurable: true, experiment: POWERED_EXPERIMENT },
      state: { ...makeCtx().state, rung: 1, running_experiments: 1 },
    });
    expect((await concurrency.run(ctx)).status).toBe('fail');
  });

  it('passes under the cap at rung 1', async () => {
    const ctx = makeCtx({
      proposal: { ...VALID_PROPOSAL, measurable: true, experiment: POWERED_EXPERIMENT },
      state: { ...makeCtx().state, rung: 1, running_experiments: 0 },
    });
    expect((await concurrency.run(ctx)).status).toBe('pass');
  });
});

describe('power-check', () => {
  const rung1 = { ...makeCtx().state, rung: 1 as const, monthly_sessions: 15_000 };

  it('passes an adequately powered large-effect test at rung 1', async () => {
    const ctx = makeCtx({
      proposal: { ...VALID_PROPOSAL, measurable: true, experiment: POWERED_EXPERIMENT },
      state: rung1,
    });
    const result = await powerCheck.run(ctx);
    expect(result.status).toBe('pass');
  });

  it('rejects an underpowered test — the Law 9 gate', async () => {
    const ctx = makeCtx({
      proposal: {
        ...VALID_PROPOSAL,
        measurable: true,
        experiment: { ...POWERED_EXPERIMENT, mde_relative: 0.05, traffic_per_arm_per_day: 10 },
      },
      state: rung1,
    });
    const result = await powerCheck.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/power/);
  });

  it('rejects a method not unlocked at the current rung', async () => {
    const ctx = makeCtx({
      proposal: {
        ...VALID_PROPOSAL,
        measurable: true,
        experiment: { ...POWERED_EXPERIMENT, method: 'multivariate' },
      },
      state: rung1,
    });
    const result = await powerCheck.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/rung/);
  });

  it('rejects invented traffic beyond what the site has', async () => {
    const ctx = makeCtx({
      proposal: {
        ...VALID_PROPOSAL,
        measurable: true,
        experiment: { ...POWERED_EXPERIMENT, traffic_per_arm_per_day: 100_000 },
      },
      state: rung1,
    });
    const result = await powerCheck.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/exceeds available traffic/);
  });

  it('rejects a CTR test shorter than the 42-day minimum', async () => {
    const ctx = makeCtx({
      proposal: {
        ...VALID_PROPOSAL,
        measurable: true,
        experiment: { ...POWERED_EXPERIMENT, primary_metric: 'SERP CTR', planned_duration_days: 14 },
      },
      state: rung1,
    });
    const result = await powerCheck.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/42d minimum/);
  });

  it('fails "Measurable: Yes" with no experiment section', async () => {
    const ctx = makeCtx({ proposal: { ...VALID_PROPOSAL, measurable: true } });
    const result = await powerCheck.run(ctx);
    expect(result.status).toBe('fail');
  });

  it('not applicable for an honest unmeasurable proposal', async () => {
    expect((await powerCheck.run(makeCtx())).status).toBe('not-applicable');
  });
});

describe('rollback-declared', () => {
  it('passes a proposal with method and condition', async () => {
    expect((await rollbackDeclared.run(makeCtx())).status).toBe('pass');
  });

  it('fails a malformed proposal', async () => {
    const ctx = makeCtx({ proposal: null, proposalError: 'missing sections' });
    const result = await rollbackDeclared.run(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/malformed/);
  });

  it('fails an empty rollback condition (Law 2)', async () => {
    const ctx = makeCtx({
      proposal: { ...VALID_PROPOSAL, rollback: { method: 'revert', condition: '' } },
    });
    expect((await rollbackDeclared.run(ctx)).status).toBe('fail');
  });
});

describe('runner', () => {
  it('fails closed when a check throws', async () => {
    const ctx = makeCtx({
      diff: parseDiff(makeDiff([{ path: GOOD }])),
      // Sabotage: unreadable repo root makes content checks throw.
      repoRoot: '/nonexistent-root-for-fail-closed-test',
    });
    const report = await runPolicy(ctx, { deterministicOnly: true });
    expect(report.pass).toBe(false);
  });

  it('an end-to-end valid rung-0 content PR passes all deterministic checks', async () => {
    const ctx = makeCtx({ diff: parseDiff(makeDiff([{ path: GOOD }])) });
    const report = await runPolicy(ctx, { deterministicOnly: true });
    expect(report.pass).toBe(true);
  });
});
