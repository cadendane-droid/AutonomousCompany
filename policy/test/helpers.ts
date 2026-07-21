import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules } from '../src/config.js';
import { parseDiff } from '../src/diff.js';
import type { CheckContext, PolicyState } from '../src/types.js';
import type { Proposal } from '@atlas/core';

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_REPO = join(here, 'fixtures', 'repo');
export const RULES = loadRules(resolve(here, '../rules.yml'));

export const DEFAULT_STATE: PolicyState = {
  rung: 0,
  frozen: false,
  running_experiments: 0,
  new_pages_last_7d: 0,
  human_approved: false,
};

/** Build a synthetic unified diff touching the given files. */
export function makeDiff(
  files: Array<{ path: string; status?: 'added' | 'modified' | 'deleted'; lines?: number }>,
): string {
  return files
    .map((f) => {
      const status = f.status ?? 'modified';
      const lines = f.lines ?? 3;
      const header =
        `diff --git a/${f.path} b/${f.path}\n` +
        (status === 'added'
          ? 'new file mode 100644\n'
          : status === 'deleted'
            ? 'deleted file mode 100644\n'
            : '') +
        `--- a/${f.path}\n+++ b/${f.path}\n@@ -1,${lines} +1,${lines} @@\n`;
      const body = Array.from({ length: lines }, (_, i) =>
        status === 'deleted' ? `-line ${i}` : `+line ${i}`,
      ).join('\n');
      return header + body;
    })
    .join('\n');
}

export const VALID_PROPOSAL: Proposal = {
  proposal: 'Add comparison table to 2 buying guides',
  rationale: 'Scroll-depth data shows 62% never reach the table',
  expected_direction: 'Increase in affiliate click rate',
  measurable: false,
  measurable_note: 'No — 340 sessions/month. Logged as Tier 1 decision.',
  guardrails: ['bounce rate', 'LCP'],
  rollback: { method: 'Revert commit', condition: 'LCP regression > 200ms over 7d' },
  risk: 'low',
};

export function makeCtx(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    diff: parseDiff(''),
    proposal: VALID_PROPOSAL,
    proposalError: null,
    rules: RULES,
    state: DEFAULT_STATE,
    repoRoot: FIXTURE_REPO,
    ...overrides,
  };
}
