// TIER A: fully working. Law 2 / Law 7 — no production change without a
// rollback path recorded BEFORE it ships. Also where a malformed proposal
// surfaces as a policy failure.
import type { PolicyCheck } from '../types.js';

export const rollbackDeclared: PolicyCheck = {
  name: 'rollback-declared',
  kind: 'deterministic',
  async run(ctx) {
    if (!ctx.proposal) {
      return {
        status: 'fail',
        message: `proposal body malformed or missing: ${ctx.proposalError ?? 'unknown parse failure'}`,
      };
    }
    const { method, condition } = ctx.proposal.rollback;
    const problems: string[] = [];
    if (!method || method.length < 3) problems.push('rollback method missing');
    if (!condition || condition.length < 3) {
      problems.push('rollback condition missing — a rollback without a trigger condition is a hope, not a plan');
    }
    if (ctx.rules.experiments.require_guardrails && ctx.proposal.guardrails.length === 0) {
      problems.push('no guardrail metrics declared (Law 3: declared before the change, not after)');
    }
    return problems.length > 0
      ? { status: 'fail', message: problems.join('; ') }
      : { status: 'pass', message: `rollback: ${method}; condition: ${condition}` };
  },
};
