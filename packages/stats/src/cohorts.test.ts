import { describe, expect, it } from 'vitest';
import { balanceCheck, stratifiedAssign, type CohortPage } from './cohorts.js';

function makePages(n: number): CohortPage[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `page-${i}`,
    impressions: (i * 37) % 500, // spread of volumes
    pageType: i % 2 === 0 ? 'buying-guide' : 'review',
    cluster: `cluster-${i % 3}`,
  }));
}

describe('stratifiedAssign', () => {
  it('assigns every page exactly once', () => {
    const pages = makePages(120);
    const { treatment, control } = stratifiedAssign(pages);
    const all = [...treatment, ...control].sort();
    expect(all).toEqual(pages.map((p) => p.id).sort());
    expect(new Set(all).size).toBe(120);
  });

  it('splits near-evenly overall and within each stratum', () => {
    const pages = makePages(120);
    const { treatment, control, strata } = stratifiedAssign(pages);
    expect(Math.abs(treatment.length - control.length)).toBeLessThanOrEqual(
      Object.keys(strata).length, // at most one leftover per stratum
    );
    for (const ids of Object.values(strata)) {
      const inTreatment = ids.filter((id) => treatment.includes(id)).length;
      expect(Math.abs(inTreatment - ids.length / 2)).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for a given seed and differs across seeds', () => {
    const pages = makePages(60);
    const a = stratifiedAssign(pages, 7);
    const b = stratifiedAssign(pages, 7);
    const c = stratifiedAssign(pages, 8);
    expect(a.treatment).toEqual(b.treatment);
    expect(a.treatment).not.toEqual(c.treatment);
  });

  it('never mixes page types within a stratum', () => {
    const pages = makePages(60);
    const { strata } = stratifiedAssign(pages);
    for (const [key, ids] of Object.entries(strata)) {
      const types = new Set(
        ids.map((id) => pages.find((p) => p.id === id)!.pageType),
      );
      expect(types.size, `stratum ${key}`).toBe(1);
    }
  });

  it('rejects a population too small to split', () => {
    expect(() => stratifiedAssign(makePages(1))).toThrow(RangeError);
  });
});

describe('balanceCheck', () => {
  it('accepts arms drawn from the same distribution', () => {
    const t = [100, 110, 95, 105, 98, 102, 107, 99];
    const c = [101, 108, 96, 104, 99, 103, 106, 98];
    expect(balanceCheck(t, c).balanced).toBe(true);
  });

  it('rejects meaningfully imbalanced arms', () => {
    const t = [100, 110, 95, 105, 98, 102];
    const c = [200, 210, 195, 205, 198, 202];
    const result = balanceCheck(t, c);
    expect(result.balanced).toBe(false);
    expect(Math.abs(result.smd)).toBeGreaterThan(0.2);
  });

  it('handles zero-variance arms without dividing by zero', () => {
    expect(balanceCheck([5, 5, 5], [5, 5, 5]).balanced).toBe(true);
  });
});
