// TIER A: pure Zod schema for the structured proposal body (plan §6.3).
import { z } from 'zod';
import { ExperimentMethodSchema, RiskTierSchema } from './enums.js';

/**
 * The structured, machine-readable PR body from implementation plan §6.3.
 * Agents emit it; policy/src/proposal-parser.ts parses and validates it;
 * the decision log ingests it. A malformed proposal is a policy failure.
 */

/** Present only when the proposal is an experiment (Rung 1+). */
export const ExperimentPlanSchema = z.object({
  method: ExperimentMethodSchema,
  primary_metric: z.string().min(1),
  baseline_rate: z.number().gt(0).lt(1),
  /** Relative MDE, e.g. 0.25 for a 25% relative lift. */
  mde_relative: z.number().gt(0),
  /** Expected sessions (or impressions) per arm per day. */
  traffic_per_arm_per_day: z.number().gt(0),
  planned_duration_days: z.number().int().positive(),
  stopping_rule: z.string().min(1),
});
export type ExperimentPlan = z.infer<typeof ExperimentPlanSchema>;

export const ProposalSchema = z.object({
  /** ## Proposal — what is being changed. */
  proposal: z.string().min(1),
  /** ## Rationale — why, with data references where available. */
  rationale: z.string().min(1),
  /** ## Expected direction — no fabricated magnitudes at Rung 0 (Law 9). */
  expected_direction: z.string().min(1),
  /**
   * ## Measurable — an honest boolean. "No" is the expected answer at
   * Rung 0 and the proposal is still valid (Law 7 requires rationale +
   * rollback, not a p-value).
   */
  measurable: z.boolean(),
  measurable_note: z.string().optional(),
  /** ## Guardrails — declared before the change, not after (Law 3). */
  guardrails: z.array(z.string().min(1)).min(1),
  /** ## Rollback — how to revert plus the condition that triggers it (Law 2). */
  rollback: z.object({
    method: z.string().min(1),
    condition: z.string().min(1),
  }),
  /** ## Risk */
  risk: RiskTierSchema,
  /** ## Experiment — required iff measurable is true and this is a test. */
  experiment: ExperimentPlanSchema.optional(),
});
export type Proposal = z.infer<typeof ProposalSchema>;