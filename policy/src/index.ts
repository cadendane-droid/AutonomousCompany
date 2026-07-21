// TIER A runner: every check runs; any check that THROWS is recorded as a
// failure (fail closed). No check can be skipped by anything in the PR.
import type { CheckContext, CheckResult, PolicyCheck, PolicyReport } from './types.js';
import { blastRadius } from './checks/blast-radius.js';
import { protectedPaths } from './checks/protected-paths.js';
import { frontmatter } from './checks/frontmatter.js';
import { disclosure } from './checks/disclosure.js';
import { internalLinks } from './checks/internal-links.js';
import { schemaMarkup } from './checks/schema-markup.js';
import { freezeState } from './checks/freeze-state.js';
import { concurrency } from './checks/concurrency.js';
import { powerCheck } from './checks/power-check.js';
import { rollbackDeclared } from './checks/rollback-declared.js';
import { qualityThreshold } from './checks/quality-threshold.js';
import { lighthouse } from './checks/lighthouse.js';

export const ALL_CHECKS: PolicyCheck[] = [
  freezeState,
  rollbackDeclared,
  blastRadius,
  protectedPaths,
  frontmatter,
  disclosure,
  internalLinks,
  schemaMarkup,
  concurrency,
  powerCheck,
  lighthouse,
  qualityThreshold,
];

export interface RunOptions {
  /** Skip model-evaluated checks (local dry runs without an API key ONLY —
   * the CI workflow never sets this; it is not reachable from PR content). */
  deterministicOnly?: boolean;
}

export async function runPolicy(ctx: CheckContext, options: RunOptions = {}): Promise<PolicyReport> {
  const checks = options.deterministicOnly
    ? ALL_CHECKS.filter((c) => c.kind === 'deterministic')
    : ALL_CHECKS;

  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      const result = await check.run(ctx);
      results.push({ name: check.name, kind: check.kind, ...result });
    } catch (err) {
      // Fail closed: an erroring check is a failing check.
      results.push({
        name: check.name,
        kind: check.kind,
        status: 'fail',
        message: `check errored (fails closed): ${err instanceof Error ? err.message : err}`,
      });
    }
  }

  return {
    pass: results.every((r) => r.status !== 'fail'),
    results,
    generatedAt: new Date().toISOString(),
  };
}

export * from './types.js';
export * from './config.js';
export * from './diff.js';
export * from './glob.js';
export * from './content.js';
export * from './proposal-parser.js';
export * from './report.js';
