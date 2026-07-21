import { describe, expect, it } from 'vitest';
import { differenceInDifferences } from './did.js';

describe('differenceInDifferences', () => {
  it('recovers a known injected effect', () => {
    // Control drifts +2; treatment drifts +2 plus a true effect of +5.
    const controlPre = [10, 12, 11, 9, 10, 11];
    const controlPost = controlPre.map((v) => v + 2);
    const treatmentPre = [10, 11, 12, 10, 9, 11];
    const treatmentPost = treatmentPre.map((v) => v + 2 + 5);

    const result = differenceInDifferences({ treatmentPre, treatmentPost, controlPre, controlPost });
    expect(result.effect).toBeCloseTo(5, 5);
    expect(result.includesZero).toBe(false);
  });

  it('a null effect yields a CI that includes zero', () => {
    const noisy = (base: number[]) => base.map((v, i) => v + (i % 2 === 0 ? 1.5 : -1.5));
    const result = differenceInDifferences({
      treatmentPre: noisy([10, 12, 11, 9, 10, 11, 12, 10]),
      treatmentPost: noisy([11, 12, 10, 10, 11, 12, 9, 11]),
      controlPre: noisy([10, 11, 12, 10, 9, 11, 10, 12]),
      controlPost: noisy([10, 12, 11, 10, 10, 11, 12, 10]),
    });
    expect(result.includesZero).toBe(true);
  });

  it('seasonality common to both arms cancels out', () => {
    // Both arms double post-period (seasonal swing); no true effect.
    const pre = [10, 12, 11, 9, 10, 11];
    const result = differenceInDifferences({
      treatmentPre: pre,
      treatmentPost: pre.map((v) => v * 2),
      controlPre: pre,
      controlPost: pre.map((v) => v * 2),
    });
    expect(result.effect).toBeCloseTo(0, 5);
  });

  it('interval widens at the stated confidence', () => {
    const input = {
      treatmentPre: [10, 12, 11, 9],
      treatmentPost: [14, 16, 13, 15],
      controlPre: [10, 11, 12, 10],
      controlPost: [11, 12, 10, 11],
    };
    const ci95 = differenceInDifferences({ ...input, confidence: 0.95 });
    const ci99 = differenceInDifferences({ ...input, confidence: 0.99 });
    const width = (r: typeof ci95) => r.confidenceInterval[1] - r.confidenceInterval[0];
    expect(width(ci99)).toBeGreaterThan(width(ci95));
  });

  it('rejects cells with fewer than 2 observations', () => {
    expect(() =>
      differenceInDifferences({
        treatmentPre: [1],
        treatmentPost: [1, 2],
        controlPre: [1, 2],
        controlPost: [1, 2],
      }),
    ).toThrow(RangeError);
  });
});
