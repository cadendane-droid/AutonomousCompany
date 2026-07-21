// TIER A: fully working, no external dependencies.
//
// Phase-weighted Company Health Score (spec §3). Weights are a data table
// keyed by rung. Any component with under 30 days of stable measurement is
// EXCLUDED and the remaining weights renormalize — new instrumentation must
// not swing the score.
import type { Rung } from '@atlas/core';

export const HEALTH_COMPONENTS = [
  'revenueGrowth',
  'organicTrafficGrowth',
  'indexationCrawlHealth',
  'contentQuality',
  'userSatisfaction',
  'returningVisitors',
  'brandSearches',
  'backlinks',
  'siteHealth',
] as const;
export type HealthComponent = (typeof HEALTH_COMPONENTS)[number];

/**
 * Weights transcribed verbatim from spec §3. NOTE: the spec's Phase 2–4
 * columns do not sum to 100 (105/115/105); the composite always normalizes
 * by total included weight, so the ratios — which are what the spec is
 * expressing — are preserved. Recorded in OPEN-QUESTIONS.md §3.
 */
export const HEALTH_WEIGHTS: Record<Rung, Record<HealthComponent, number>> = {
  0: {
    revenueGrowth: 0,
    organicTrafficGrowth: 40,
    indexationCrawlHealth: 25,
    contentQuality: 20,
    userSatisfaction: 5,
    returningVisitors: 0,
    brandSearches: 0,
    backlinks: 5,
    siteHealth: 5,
  },
  1: {
    revenueGrowth: 15,
    organicTrafficGrowth: 30,
    indexationCrawlHealth: 10,
    contentQuality: 15,
    userSatisfaction: 10,
    returningVisitors: 10,
    brandSearches: 5,
    backlinks: 5,
    siteHealth: 5,
  },
  2: {
    revenueGrowth: 30,
    organicTrafficGrowth: 20,
    indexationCrawlHealth: 5,
    contentQuality: 10,
    userSatisfaction: 15,
    returningVisitors: 15,
    brandSearches: 10,
    backlinks: 5,
    siteHealth: 5,
  },
  3: {
    revenueGrowth: 30,
    organicTrafficGrowth: 15,
    indexationCrawlHealth: 5,
    contentQuality: 5,
    userSatisfaction: 15,
    returningVisitors: 15,
    brandSearches: 10,
    backlinks: 5,
    siteHealth: 5,
  },
};

/** Days of stable measurement a component needs before it counts (spec §3). */
export const MIN_STABLE_DAYS = 30;

export interface ComponentReading {
  /** Normalized component score, 0–100. */
  score: number;
  /** Days of stable measurement behind this reading. */
  stableDays: number;
}

export interface HealthScoreResult {
  /** Weighted composite, 0–100, over included components only. */
  score: number;
  included: HealthComponent[];
  /** Excluded for instability (< 30 days) or missing readings. */
  excluded: HealthComponent[];
  /** Effective (renormalized) weight actually applied per component. */
  effectiveWeights: Partial<Record<HealthComponent, number>>;
}

export function computeHealthScore(
  rung: Rung,
  readings: Partial<Record<HealthComponent, ComponentReading>>,
): HealthScoreResult {
  const weights = HEALTH_WEIGHTS[rung];
  const included: HealthComponent[] = [];
  const excluded: HealthComponent[] = [];

  for (const component of HEALTH_COMPONENTS) {
    const reading = readings[component];
    const weight = weights[component];
    if (weight === 0) continue; // zero-weight components are neither included nor "excluded"
    if (!reading || reading.stableDays < MIN_STABLE_DAYS) {
      excluded.push(component);
      continue;
    }
    if (reading.score < 0 || reading.score > 100) {
      throw new RangeError(`${component} score must be 0–100, got ${reading.score}`);
    }
    included.push(component);
  }

  const totalWeight = included.reduce((sum, c) => sum + weights[c], 0);
  if (totalWeight === 0) {
    return { score: 0, included, excluded, effectiveWeights: {} };
  }

  const effectiveWeights: Partial<Record<HealthComponent, number>> = {};
  let score = 0;
  for (const component of included) {
    const w = weights[component] / totalWeight;
    effectiveWeights[component] = w;
    score += w * readings[component]!.score;
  }

  return { score, included, excluded, effectiveWeights };
}
