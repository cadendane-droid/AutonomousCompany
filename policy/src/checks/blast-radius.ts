// TIER A: fully working. Law 8 — blast radius and evidence scale together.
import type { PolicyCheck } from '../types.js';
import { changedContentFiles } from '../content.js';

export const blastRadius: PolicyCheck = {
  name: 'blast-radius',
  kind: 'deterministic',
  async run(ctx) {
    const { blast_radius: limits } = ctx.rules;
    const violations: string[] = [];

    if (ctx.diff.files.length > limits.max_files_changed) {
      violations.push(`${ctx.diff.files.length} files changed (max ${limits.max_files_changed})`);
    }

    const linesChanged = ctx.diff.totalAdditions + ctx.diff.totalDeletions;
    if (linesChanged > limits.max_lines_changed) {
      violations.push(`${linesChanged} lines changed (max ${limits.max_lines_changed})`);
    }

    const deletions = ctx.diff.files.filter((f) => f.status === 'deleted').length;
    if (deletions > limits.max_deletions_per_pr) {
      violations.push(`${deletions} files deleted (max ${limits.max_deletions_per_pr})`);
    }

    const newPages = changedContentFiles(ctx).filter((f) => f.status === 'added').length;
    if (newPages + ctx.state.new_pages_last_7d > limits.max_new_pages_per_week) {
      violations.push(
        `${newPages} new pages + ${ctx.state.new_pages_last_7d} published this week ` +
          `exceeds ${limits.max_new_pages_per_week}/week (thin-content flood guard)`,
      );
    }

    return violations.length > 0
      ? { status: 'fail', message: violations.join('; '), details: { violations } }
      : { status: 'pass', message: `${ctx.diff.files.length} files, ${linesChanged} lines — within blast radius` };
  },
};
