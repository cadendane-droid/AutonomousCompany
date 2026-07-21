import { describe, expect, it } from 'vitest';
import { achievablePower, sampleSizeNormalApprox, sampleSizeRuleOfThumb } from './power.js';

/**
 * Effect-size table from spec §4 (80% power, α = 0.05, two-sided).
 * The rule-of-thumb implementation must reproduce it.
 */
const SPEC_EFFECT_SIZE_TABLE: Array<{ baseline: number; lift: number; nPerArm: number }> = [
  { baseline: 0.05, lift: 0.5, nPerArm: 1_200 },
  { baseline: 0.05, lift: 0.25, nPerArm: 4_900 },
  { baseline: 0.05, lift: 0.1, nPerArm: 30_000 },
  { baseline: 0.05, lift: 0.05, nPerArm: 122_000 },
  { baseline: 0.02, lift: 0.5, nPerArm: 3_100 },
  { baseline: 0.02, lift: 0.25, nPerArm: 12_500 },
];

describe('sampleSizeRuleOfThumb — reproduces the spec §4 table', () => {
  for (const { baseline, lift, nPerArm } of SPEC_EFFECT_SIZE_TABLE) {
    it(`baseline ${baseline * 100}%, lift ${lift * 100}% → ~${nPerArm} per arm`, () => {
      const n = sampleSizeRuleOfThumb(baseline, lift);
      // The spec rounds to 2 significant figures; allow 5%.
      expect(n).toBeGreaterThan(nPerArm * 0.95);
      expect(n).toBeLessThan(nPerArm * 1.05);
    });
  }
});

describe('sampleSizeNormalApprox', () => {
  it('agrees with the rule of thumb within ~25%', () => {
    // The rule of thumb uses baseline variance only; the exact formula uses
    // both arms', so they diverge most at large lifts (~21% at a 50% lift).
    for (const { baseline, lift } of SPEC_EFFECT_SIZE_TABLE) {
      const rot = sampleSizeRuleOfThumb(baseline, lift);
      const exact = sampleSizeNormalApprox({ baselineRate: baseline, mde: lift });
      expect(Math.abs(exact - rot) / rot).toBeLessThan(0.25);
    }
  });

  it('shrinks with a larger MDE', () => {
    const small = sampleSizeNormalApprox({ baselineRate: 0.05, mde: 0.1 });
    const large = sampleSizeNormalApprox({ baselineRate: 0.05, mde: 0.5 });
    expect(large).toBeLessThan(small);
  });

  it('rejects impossible rates', () => {
    expect(() => sampleSizeNormalApprox({ baselineRate: 0, mde: 0.5 })).toThrow(RangeError);
    expect(() => sampleSizeNormalApprox({ baselineRate: 0.6, mde: 0.9 })).toThrow(RangeError);
  });
});

describe('achievablePower — the Policy Engine gate', () => {
  it('a Rung 0 site cannot power a 5% lift on 3% CTR (the spec §4 example)', () => {
    // ~200 users/arm/month with a 20% rollout cap at 1,000 sessions/month
    const result = achievablePower({
      baselineRate: 0.03,
      mde: 0.05,
      trafficPerArm: 200 / 30,
      durationDays: 30,
    });
    expect(result.adequatelyPowered).toBe(false);
    expect(result.power).toBeLessThan(0.1);
  });

  it('an adequately-sized test passes', () => {
    const required = sampleSizeNormalApprox({ baselineRate: 0.05, mde: 0.5 });
    const result = achievablePower({
      baselineRate: 0.05,
      mde: 0.5,
      trafficPerArm: required / 30,
      durationDays: 31,
    });
    expect(result.adequatelyPowered).toBe(true);
    expect(result.power).toBeGreaterThanOrEqual(0.8);
  });

  it('power at exactly the required n is ~0.8', () => {
    const required = sampleSizeNormalApprox({ baselineRate: 0.05, mde: 0.25 });
    const result = achievablePower({
      baselineRate: 0.05,
      mde: 0.25,
      trafficPerArm: required,
      durationDays: 1,
    });
    expect(result.power).toBeGreaterThan(0.78);
    expect(result.power).toBeLessThan(0.83);
  });

  it('zero traffic → zero power, not NaN', () => {
    const result = achievablePower({
      baselineRate: 0.05,
      mde: 0.25,
      trafficPerArm: 0,
      durationDays: 30,
    });
    expect(result.power).toBe(0);
    expect(result.adequatelyPowered).toBe(false);
  });
});
