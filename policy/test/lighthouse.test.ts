// TIER A: pass and fail paths for the Lighthouse regression check (plan §5.3).
import { describe, expect, it } from 'vitest';
import { lighthouse } from '../src/checks/lighthouse.js';
import { parseDiff } from '../src/diff.js';
import { DEFAULT_STATE, RULES, makeCtx, makeDiff } from './helpers.js';
import type { PolicyRules } from '../src/config.js';

const siteDiff = parseDiff(makeDiff([{ path: 'site/src/pages/index.astro' }]));
const nonSiteDiff = parseDiff(makeDiff([{ path: 'packages/stats/src/power.ts' }]));

/** rules.yml with require_lighthouse flipped on, as it will be post-setup. */
const REQUIRED: PolicyRules = {
  ...RULES,
  technical: { ...RULES.technical, require_lighthouse: true },
};

describe('lighthouse check', () => {
  it('does not apply when no site/ files changed', async () => {
    const result = await lighthouse.run(makeCtx({ diff: nonSiteDiff }));
    expect(result.status).toBe('not-applicable');
  });

  it('passes a preview above the minimum with no regression', async () => {
    const result = await lighthouse.run(
      makeCtx({
        diff: siteDiff,
        state: { ...DEFAULT_STATE, lighthouse: { baseline: 97, preview: 98 } },
      }),
    );
    expect(result.status).toBe('pass');
  });

  it('fails a regression larger than the configured maximum', async () => {
    const result = await lighthouse.run(
      makeCtx({
        diff: siteDiff,
        state: { ...DEFAULT_STATE, lighthouse: { baseline: 99, preview: 91 } },
      }),
    );
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/regressed/);
  });

  it('allows a regression at exactly the threshold', async () => {
    const result = await lighthouse.run(
      makeCtx({
        diff: siteDiff,
        state: { ...DEFAULT_STATE, lighthouse: { baseline: 100, preview: 95 } },
      }),
    );
    expect(result.status).toBe('pass');
  });

  it('fails a preview below the absolute minimum even without a baseline', async () => {
    const result = await lighthouse.run(
      makeCtx({
        diff: siteDiff,
        state: { ...DEFAULT_STATE, lighthouse: { baseline: null, preview: 80 } },
      }),
    );
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/below minimum/);
  });

  it('reports honestly rather than passing when no score is supplied and it is not required', async () => {
    const result = await lighthouse.run(makeCtx({ diff: siteDiff }));
    expect(result.status).toBe('not-applicable');
  });

  it('fails closed when a score is required but missing', async () => {
    const result = await lighthouse.run(makeCtx({ diff: siteDiff, rules: REQUIRED }));
    expect(result.status).toBe('fail');
  });
});
