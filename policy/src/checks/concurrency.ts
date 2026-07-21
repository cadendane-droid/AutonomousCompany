// TIER A: fully working. Spec §5.4 — concurrency caps by rung, from the
// rules.yml table (0:0, 1:1, 2:3, 3:10).
import type { PolicyCheck } from '../types.js';

export const concurrency: PolicyCheck = {
  name: 'concurrency',
  kind: 'deterministic',
  async run(ctx) {
    if (!ctx.proposal?.experiment) {
      return { status: 'not-applicable', message: 'not an experiment proposal' };
    }
    const cap = ctx.rules.experiments.max_concurrent_by_rung[String(ctx.state.rung)];
    if (cap === undefined) {
      return { status: 'fail', message: `no concurrency cap configured for rung ${ctx.state.rung}` };
    }
    if (cap === 0) {
      return {
        status: 'fail',
        message: `Rung ${ctx.state.rung} permits no experiments — log the change as a decision instead (spec §4)`,
      };
    }
    if (ctx.state.running_experiments + 1 > cap) {
      return {
        status: 'fail',
        message: `${ctx.state.running_experiments} experiment(s) already running; cap at rung ${ctx.state.rung} is ${cap}`,
      };
    }
    return {
      status: 'pass',
      message: `${ctx.state.running_experiments + 1}/${cap} concurrent experiments at rung ${ctx.state.rung}`,
    };
  },
};
