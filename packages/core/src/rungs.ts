import type { ExperimentMethod, KnowledgeTier, Rung } from './enums.js';

/**
 * The maturity ladder as data (spec §4).
 *
 * The Policy Engine READS this table; rung logic must never be scattered
 * across files. Changing what a rung permits is a change here plus a review,
 * nothing else.
 */
export interface RungDefinition {
  rung: Rung;
  name: string;
  /** Sustained monthly sessions required to ENTER this rung. */
  minMonthlySessions: number;
  /** Additional entry conditions, human-checked (plan §9, §10). */
  entryConditions: string[];
  /** Experiment methods statistically supportable at this rung (spec §5.3). */
  allowedMethods: ExperimentMethod[];
  /** Max concurrent experiments (spec §5.4, policy rules.yml). */
  maxConcurrentExperiments: number;
  /**
   * Highest knowledge tier that promotions may REACH at this rung (spec §8).
   * Rung 0 records decisions only; Rung 1 may promote to working-belief;
   * Rung 2+ may promote to principle.
   */
  promotableTiers: KnowledgeTier[];
  /** Max single-step permanent rollout (spec §5.5). 1 = direct with logging. */
  rolloutSteps: number[];
}

export const RUNG_DEFINITIONS: Record<Rung, RungDefinition> = {
  0: {
    rung: 0,
    name: 'Foundation',
    minMonthlySessions: 0,
    entryConditions: [],
    allowedMethods: ['decision-log'],
    maxConcurrentExperiments: 0,
    promotableTiers: ['decision'],
    rolloutSteps: [1], // direct with logging — nothing to test against
  },
  1: {
    rung: 1,
    name: 'Directional Measurement',
    minMonthlySessions: 1000,
    entryConditions: [
      '1,000+ sessions/month sustained 8 weeks',
      '100+ comparable pages (for split-URL cohorts)',
    ],
    allowedMethods: ['decision-log', 'pre-post-cohort', 'split-url-cohort', 'ab-test'],
    maxConcurrentExperiments: 1,
    promotableTiers: ['decision', 'working-belief'],
    rolloutSteps: [0.5, 1], // 50% steps, hold 2 weeks
  },
  2: {
    rung: 2,
    name: 'Controlled Experimentation',
    minMonthlySessions: 10_000,
    entryConditions: ['10,000+ sessions/month sustained 8 weeks'],
    allowedMethods: [
      'decision-log',
      'pre-post-cohort',
      'split-url-cohort',
      'ab-test',
      'sequential',
    ],
    maxConcurrentExperiments: 3,
    promotableTiers: ['decision', 'working-belief', 'principle'],
    rolloutSteps: [0.25, 0.5, 1],
  },
  3: {
    rung: 3,
    name: 'Compounding',
    minMonthlySessions: 100_000,
    entryConditions: ['100,000+ sessions/month, or multi-tenant aggregate'],
    allowedMethods: [
      'decision-log',
      'pre-post-cohort',
      'split-url-cohort',
      'ab-test',
      'sequential',
      'multivariate',
    ],
    maxConcurrentExperiments: 10,
    promotableTiers: ['decision', 'working-belief', 'principle'],
    rolloutSteps: [0.1, 0.25, 0.5, 1],
  },
};

export function rungDefinition(rung: Rung): RungDefinition {
  return RUNG_DEFINITIONS[rung];
}
