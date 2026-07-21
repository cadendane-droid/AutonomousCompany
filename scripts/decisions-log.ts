// TIER B: logic complete, untested against a live Postgres.
//
// Record a Tier 1 decision (plan §7.3). Used for backfilling changes made
// before the agent runtime existed, and for any human change that should be in
// the log — which is all of them.
//
// Two arguments are mandatory and deliberately awkward to supply carelessly:
//   --measurable yes|no   Law 9. "no" is the honest answer at Rung 0 and is
//                         expected far more often than "yes".
//   --rollback <ref>      Law 2. The database rejects a null.
//
// Usage:
//   pnpm decisions:log --summary "..." --rationale "..." \
//     --measurable no --rollback "revert abc1234"
import { getTenantBySlug, logDecision } from '@atlas/db';
import { DecisionKindSchema, DEFAULT_TENANT_SLUG, RoleNameSchema } from '@atlas/core';
import { arg, requireArg, run } from './lib/args.ts';

const USAGE = `usage: pnpm decisions:log \\
  --summary "<what changed>" \\
  --rationale "<why>" \\
  --measurable yes|no \\
  --rollback "<how to undo it>" \\
  [--tenant <slug>] [--role <role>] [--kind <kind>] \\
  [--expected "<direction>"] [--measurement-plan "<plan>"] \\
  [--guardrails "metric,metric"] [--pr <url>] [--date YYYY-MM-DD]`;

await run(async () => {
  const summary = requireArg('summary', USAGE);
  const rationale = requireArg('rationale', USAGE);
  const rollbackRef = requireArg('rollback', USAGE);
  const measurableRaw = requireArg('measurable', USAGE).toLowerCase();

  if (!['yes', 'no', 'true', 'false'].includes(measurableRaw)) {
    throw new Error(
      `--measurable must be yes or no, got "${measurableRaw}". This is an honest ` +
        `boolean, not a confidence score (Law 9).`,
    );
  }
  const measurable = measurableRaw === 'yes' || measurableRaw === 'true';

  const measurementPlan = arg('measurement-plan') ?? null;
  if (measurable && !measurementPlan) {
    throw new Error(
      'a decision marked measurable must state --measurement-plan. Claiming ' +
        'measurability without a plan is how unmeasured changes become "evidence".',
    );
  }

  const tenantSlug = arg('tenant') ?? DEFAULT_TENANT_SLUG;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error(`tenant "${tenantSlug}" not found — run pnpm db:seed first`);

  const guardrailsRaw = arg('guardrails');
  const dateRaw = arg('date');

  const decision = await logDecision({
    tenantId: tenant.id,
    date: dateRaw ? new Date(dateRaw) : new Date(),
    role: arg('role') ? RoleNameSchema.parse(arg('role')) : null,
    kind: arg('kind') ? DecisionKindSchema.parse(arg('kind')) : null,
    summary,
    rationale,
    expectedDirection: arg('expected') ?? null,
    affectedPages: null,
    measurable,
    measurementPlan,
    guardrails: guardrailsRaw ? guardrailsRaw.split(',').map((g) => g.trim()) : null,
    rollbackRef,
    prUrl: arg('pr') ?? null,
  });

  console.log(`logged decision ${decision.id} (measurable: ${measurable})`);
  if (!measurable) {
    console.log(
      'Recorded as unmeasured. That is the correct and expected outcome at Rung 0 — ' +
        'Law 7 requires a rationale and a rollback condition, not a p-value.',
    );
  }
});
