// TIER A: fully working. Plan §5.3 — "Lighthouse on preview >= threshold,
// blocks on regression > 5 points"; plan §3.2 — Lighthouse 95+ on mobile.
//
// The score is supplied by the CI workflow, which runs LHCI against the Vercel
// preview deploy and writes it into the policy state. Nothing in the PR can
// report its own score.
import type { PolicyCheck } from '../types.js';

/** Paths whose changes can plausibly move a Lighthouse score. */
function touchesSite(paths: string[]): boolean {
  return paths.some((p) => p.startsWith('site/'));
}

export const lighthouse: PolicyCheck = {
  name: 'lighthouse',
  kind: 'deterministic',
  async run(ctx) {
    const { technical } = ctx.rules;
    const changed = ctx.diff.files.map((f) => f.path);

    if (!touchesSite(changed)) {
      return { status: 'not-applicable', message: 'no site/ files changed' };
    }

    const measured = ctx.state.lighthouse ?? null;

    if (measured === null) {
      // Fail closed only once a preview environment exists to measure. Before
      // that, require_lighthouse is false and the check reports honestly that
      // it did not run, rather than passing as though it had.
      return technical.require_lighthouse
        ? {
            status: 'fail',
            message:
              'site/ changed but no preview Lighthouse score was supplied ' +
              '(technical.require_lighthouse is true — fails closed)',
          }
        : {
            status: 'not-applicable',
            message:
              'no preview Lighthouse score; technical.require_lighthouse is false ' +
              '(TODO(setup): enable once Vercel preview + LHCI are wired)',
          };
    }

    const violations: string[] = [];

    if (measured.preview < technical.min_lighthouse) {
      violations.push(
        `preview Lighthouse ${measured.preview} below minimum ${technical.min_lighthouse}`,
      );
    }

    if (measured.baseline !== null) {
      const regression = measured.baseline - measured.preview;
      if (regression > technical.max_lighthouse_regression) {
        violations.push(
          `Lighthouse regressed ${regression.toFixed(1)} points ` +
            `(${measured.baseline} to ${measured.preview}, max ${technical.max_lighthouse_regression})`,
        );
      }
    }

    return violations.length > 0
      ? { status: 'fail', message: violations.join('; '), details: { violations, measured } }
      : {
          status: 'pass',
          message: `preview Lighthouse ${measured.preview} within threshold`,
          details: { measured },
        };
  },
};
