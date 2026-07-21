// TIER A: fully working. Spec §12 — freeze halts all non-critical merges.
// Only a human clears a freeze (rules.yml freeze.manual_override: human_only);
// there is deliberately no override this check reads from the PR.
import type { PolicyCheck } from '../types.js';

export const freezeState: PolicyCheck = {
  name: 'freeze-state',
  kind: 'deterministic',
  async run(ctx) {
    if (!ctx.state.frozen) {
      return { status: 'pass', message: 'system not frozen' };
    }
    return {
      status: 'fail',
      message:
        `system is FROZEN (${ctx.state.freeze_reason ?? 'no reason recorded'}). ` +
        `No merges until a human unfreezes (scripts/system-unfreeze).`,
    };
  },
};
