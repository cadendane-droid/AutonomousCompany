import { describe, expect, it } from 'vitest';
import { parseProposal } from '../src/proposal-parser.js';

const VALID_BODY = `## Proposal
Add comparison table to 4 buying guides in the \`tents\` cluster.

## Rationale
Scroll-depth data: 62% of sessions never reach the current table position.

## Expected direction
Increase in affiliate click rate on affected pages.

## Measurable
No — current traffic 340 sessions/month. Logged as Tier 1 decision.

## Guardrails
Bounce rate, LCP.

## Rollback
Revert commit. Condition: LCP regression > 200ms, or bounce rate +10% over 30d.

## Risk
Low. 4 files, no protected paths.
`;

describe('parseProposal', () => {
  it('parses the plan §6.3 example body', () => {
    const { proposal, error } = parseProposal(VALID_BODY);
    expect(error).toBeNull();
    expect(proposal).not.toBeNull();
    expect(proposal!.measurable).toBe(false);
    expect(proposal!.guardrails).toEqual(['Bounce rate', 'LCP']);
    expect(proposal!.rollback.method).toBe('Revert commit');
    expect(proposal!.rollback.condition).toMatch(/LCP regression/);
    expect(proposal!.risk).toBe('low');
  });

  it('parses an experiment proposal with a YAML block', () => {
    const body =
      VALID_BODY.replace('No — current', 'Yes — current') +
      `
## Experiment
\`\`\`yaml
method: ab-test
primary_metric: affiliate conversion rate
baseline_rate: 0.05
mde_relative: 0.5
traffic_per_arm_per_day: 200
planned_duration_days: 14
stopping_rule: fixed horizon, no peeking
\`\`\`
`;
    const { proposal, error } = parseProposal(body);
    expect(error).toBeNull();
    expect(proposal!.experiment?.method).toBe('ab-test');
    expect(proposal!.experiment?.mde_relative).toBe(0.5);
  });

  it('rejects a body missing required sections', () => {
    const { proposal, error } = parseProposal('## Proposal\nJust vibes.');
    expect(proposal).toBeNull();
    expect(error).toMatch(/missing required sections/);
  });

  it('rejects a non-boolean Measurable (Law 9: no hedging)', () => {
    const body = VALID_BODY.replace(
      'No — current traffic 340 sessions/month. Logged as Tier 1 decision.',
      'Probably, with enough time.',
    );
    const { proposal, error } = parseProposal(body);
    expect(proposal).toBeNull();
    expect(error).toMatch(/Measurable/);
  });

  it('rejects an invalid risk tier', () => {
    const body = VALID_BODY.replace('Low. 4 files', 'Negligible. 4 files');
    const { proposal, error } = parseProposal(body);
    expect(proposal).toBeNull();
    expect(error).toMatch(/Risk/);
  });

  it('rejects a malformed experiment block instead of ignoring it', () => {
    const body = VALID_BODY + '\n## Experiment\nmethod: ab-test\nbaseline_rate: 2.0\n';
    const { proposal, error } = parseProposal(body);
    expect(proposal).toBeNull();
    expect(error).toMatch(/Experiment/);
  });
});
