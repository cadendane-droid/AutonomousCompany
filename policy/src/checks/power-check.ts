// TIER A: fully working. The mechanical enforcement of Law 9 (plan §5.3).
//
// An agent proposing a test whose sample cannot detect its stated MDE is
// rejected at the gate — before it can produce a meaningless number someone
// later mistakes for evidence.
import { achievablePower } from '@atlas/stats';
import { rungDefinition } from '@atlas/core';
import type { PolicyCheck } from '../types.js';

/** Map the experiment's primary metric onto rules.yml min-duration signal types. */
function signalType(primaryMetric: string): 'conversion' | 'ctr' | 'ranking' {
  const metric = primaryMetric.toLowerCase();
  if (/\bctr\b|click-?through/.test(metric)) return 'ctr';
  if (/rank|position|traffic|impression/.test(metric)) return 'ranking';
  return 'conversion';
}

export const powerCheck: PolicyCheck = {
  name: 'power-check',
  kind: 'deterministic',
  async run(ctx) {
    const experiment = ctx.proposal?.experiment;
    if (!experiment) {
      if (ctx.proposal?.measurable === true) {
        return {
          status: 'fail',
          message:
            'proposal claims Measurable: Yes but has no ## Experiment section — ' +
            'a measurable claim requires a stated design (Law 9)',
        };
      }
      return { status: 'not-applicable', message: 'not an experiment proposal' };
    }

    const problems: string[] = [];

    // 1. Method allowed at the current rung (the maturity ladder is data).
    const rung = rungDefinition(ctx.state.rung);
    if (!rung.allowedMethods.includes(experiment.method)) {
      problems.push(
        `method "${experiment.method}" is not available at rung ${rung.rung} (${rung.name}); ` +
          `allowed: ${rung.allowedMethods.join(', ')}`,
      );
    }

    // 2. Minimum duration for the signal type (rules.yml).
    const signal = signalType(experiment.primary_metric);
    const minDays = ctx.rules.experiments.min_duration_days_by_type[signal];
    if (experiment.planned_duration_days < minDays) {
      problems.push(
        `${experiment.planned_duration_days}d duration is below the ${minDays}d minimum for ${signal} signals`,
      );
    }

    // 3. The stated traffic must be consistent with the site's actual traffic.
    //    An agent cannot power a test by inventing visitors.
    if (ctx.state.monthly_sessions !== undefined) {
      const dailySessions = ctx.state.monthly_sessions / 28;
      // Two arms; 20% tolerance for impressions-vs-sessions slop.
      if (experiment.traffic_per_arm_per_day * 2 > dailySessions * 1.2) {
        problems.push(
          `stated ${experiment.traffic_per_arm_per_day}/arm/day exceeds available traffic ` +
            `(~${dailySessions.toFixed(0)} sessions/day total)`,
        );
      }
    }

    // 4. The power computation itself.
    if (ctx.rules.experiments.require_power_check) {
      const result = achievablePower({
        baselineRate: experiment.baseline_rate,
        mde: experiment.mde_relative,
        trafficPerArm: experiment.traffic_per_arm_per_day,
        durationDays: experiment.planned_duration_days,
      });
      if (result.power < ctx.rules.experiments.min_power) {
        problems.push(
          `achievable power ${(result.power * 100).toFixed(1)}% < required ` +
            `${ctx.rules.experiments.min_power * 100}% — n/arm ${result.nPerArm} vs ` +
            `${result.requiredNPerArm} required to detect a ${experiment.mde_relative * 100}% ` +
            `relative lift on a ${experiment.baseline_rate * 100}% baseline. ` +
            `An underpowered "win" is more likely noise than signal (spec §4).`,
        );
      }
    }

    return problems.length > 0
      ? { status: 'fail', message: problems.join('; '), details: { problems } }
      : { status: 'pass', message: 'experiment is adequately powered and permitted at this rung' };
  },
};
