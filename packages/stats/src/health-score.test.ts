import { describe, expect, it } from 'vitest';
import {
  computeHealthScore,
  HEALTH_WEIGHTS,
  type ComponentReading,
  type HealthComponent,
} from './health-score.js';

const stable = (score: number): ComponentReading => ({ score, stableDays: 90 });

function allComponents(score: number): Record<HealthComponent, ComponentReading> {
  return {
    revenueGrowth: stable(score),
    organicTrafficGrowth: stable(score),
    indexationCrawlHealth: stable(score),
    contentQuality: stable(score),
    userSatisfaction: stable(score),
    returningVisitors: stable(score),
    brandSearches: stable(score),
    backlinks: stable(score),
    siteHealth: stable(score),
  };
}

describe('computeHealthScore', () => {
  it('uniform component scores produce that score at every rung', () => {
    for (const rung of [0, 1, 2, 3] as const) {
      expect(computeHealthScore(rung, allComponents(70)).score).toBeCloseTo(70, 6);
    }
  });

  it('Rung 0 ignores revenue entirely (weight 0)', () => {
    const readings = allComponents(50);
    readings.revenueGrowth = stable(100); // should not move the needle
    const base = computeHealthScore(0, allComponents(50));
    const withRevenue = computeHealthScore(0, readings);
    expect(withRevenue.score).toBeCloseTo(base.score, 6);
    expect(withRevenue.included).not.toContain('revenueGrowth');
  });

  it('components under 30 stable days are excluded and weights renormalize', () => {
    const readings = allComponents(60);
    readings.organicTrafficGrowth = { score: 0, stableDays: 5 }; // new instrumentation
    const result = computeHealthScore(0, readings);
    expect(result.excluded).toContain('organicTrafficGrowth');
    // Remaining components all read 60, so the composite must still be 60 —
    // the unstable zero must NOT drag it down.
    expect(result.score).toBeCloseTo(60, 6);
  });

  it('missing components are excluded, not treated as zero', () => {
    const result = computeHealthScore(0, {
      organicTrafficGrowth: stable(80),
      indexationCrawlHealth: stable(80),
    });
    expect(result.score).toBeCloseTo(80, 6);
    expect(result.excluded).toContain('contentQuality');
  });

  it('no measurable components yields zero, not NaN', () => {
    const result = computeHealthScore(0, {});
    expect(result.score).toBe(0);
    expect(Number.isNaN(result.score)).toBe(false);
  });

  it('effective weights sum to 1 over included components', () => {
    const result = computeHealthScore(2, allComponents(50));
    const total = Object.values(result.effectiveWeights).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it('weights table transcribes spec §3 Phase 1 exactly', () => {
    expect(HEALTH_WEIGHTS[0].organicTrafficGrowth).toBe(40);
    expect(HEALTH_WEIGHTS[0].indexationCrawlHealth).toBe(25);
    expect(HEALTH_WEIGHTS[0].contentQuality).toBe(20);
    expect(HEALTH_WEIGHTS[0].revenueGrowth).toBe(0);
  });

  it('rejects out-of-range scores loudly', () => {
    expect(() =>
      computeHealthScore(0, { organicTrafficGrowth: { score: 140, stableDays: 90 } }),
    ).toThrow(RangeError);
  });
});
