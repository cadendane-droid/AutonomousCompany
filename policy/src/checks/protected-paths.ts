// TIER A: fully working.
//
// Human approval is expressed ONLY through GitHub's own review mechanism —
// the workflow sets state.human_approved from the reviews API. There is no
// label, commit-message token, or PR-body override an agent could apply.
import type { PolicyCheck } from '../types.js';
import { matchesAny } from '../glob.js';

export const protectedPaths: PolicyCheck = {
  name: 'protected-paths',
  kind: 'deterministic',
  async run(ctx) {
    const touched = ctx.diff.files
      .map((f) => ({ path: f.path, pattern: matchesAny(f.path, ctx.rules.protected.paths) }))
      .filter((m) => m.pattern !== null);

    if (touched.length === 0) {
      return { status: 'pass', message: 'no protected paths touched' };
    }
    if (ctx.state.human_approved) {
      return {
        status: 'pass',
        message: `protected paths touched (${touched.map((t) => t.path).join(', ')}) — human approval present`,
      };
    }
    return {
      status: 'fail',
      message:
        `protected paths touched without human approval: ` +
        touched.map((t) => `${t.path} (rule: ${t.pattern})`).join(', '),
      details: { touched },
    };
  },
};
