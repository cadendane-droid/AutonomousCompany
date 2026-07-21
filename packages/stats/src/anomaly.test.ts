import { describe, expect, it } from 'vitest';
import { detectAnomaly, type SeriesPoint } from './anomaly.js';

/** Build a daily series ending 2026-07-20. */
function series(values: number[]): SeriesPoint[] {
  const end = new Date('2026-07-20T12:00:00Z');
  return values.map((value, i) => {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (values.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), value };
  });
}

describe('detectAnomaly', () => {
  it('flags a collapse against a stable baseline', () => {
    const stable = Array.from({ length: 28 }, (_, i) => 100 + (i % 3)); // ~100 ± 1
    const verdict = detectAnomaly(series([...stable, 10]), {
      volumeFloor: 20,
      dayOfWeekAdjust: false,
    });
    expect(verdict.status).toBe('anomaly');
    if (verdict.status === 'anomaly') {
      expect(verdict.direction).toBe('down');
      expect(verdict.zScore).toBeLessThan(-3);
    }
  });

  it('does not flag normal variation', () => {
    const noisy = Array.from({ length: 29 }, (_, i) => 100 + 10 * Math.sin(i));
    const verdict = detectAnomaly(series(noisy), { volumeFloor: 20, dayOfWeekAdjust: false });
    expect(verdict.status).toBe('normal');
  });

  it('declares low-volume metrics too noisy instead of alerting — the floor matters more than the detector', () => {
    // ~10 sessions/day: a "300 sessions/month" site. A 3x swing is noise here.
    const tiny = Array.from({ length: 28 }, (_, i) => (i % 4 === 0 ? 3 : 12));
    const verdict = detectAnomaly(series([...tiny, 30]), {
      volumeFloor: 50,
      dayOfWeekAdjust: false,
    });
    expect(verdict.status).toBe('too-noisy');
  });

  it('day-of-week adjustment absorbs weekly seasonality', () => {
    // Weekdays ~100, weekends ~40, keyed off the REAL calendar weekday.
    // Series ends Sunday 2026-07-19 with a weekend-typical value of 41.
    const end = new Date('2026-07-19T12:00:00Z'); // a Sunday
    const s = Array.from({ length: 57 }, (_, i) => {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - (56 - i));
      const dow = d.getUTCDay();
      const base = dow === 0 || dow === 6 ? 40 : 100;
      return { date: d.toISOString().slice(0, 10), value: base + (i % 3) };
    });
    s[s.length - 1] = { ...s[s.length - 1]!, value: 41 };

    const adjusted = detectAnomaly(s, { volumeFloor: 10, dayOfWeekAdjust: true });
    expect(adjusted.status).toBe('normal');
    if (adjusted.status === 'normal') expect(Math.abs(adjusted.zScore)).toBeLessThan(1);

    // Unadjusted, the weekend value reads misleadingly low against the mixed
    // weekly baseline (bloated variance keeps it under 3σ, but the z-score
    // is distorted — exactly the noise the adjustment removes).
    const unadjusted = detectAnomaly(s, { volumeFloor: 10, dayOfWeekAdjust: false });
    if (unadjusted.status === 'normal') expect(unadjusted.zScore).toBeLessThan(-1);
  });

  it('returns insufficient-data below the minimum window', () => {
    const verdict = detectAnomaly(series([1, 2, 3]), { volumeFloor: 0 });
    expect(verdict.status).toBe('insufficient-data');
  });

  it('a spike also flags (direction up)', () => {
    const stable = Array.from({ length: 28 }, (_, i) => 100 + (i % 3));
    const verdict = detectAnomaly(series([...stable, 400]), {
      volumeFloor: 20,
      dayOfWeekAdjust: false,
    });
    expect(verdict.status).toBe('anomaly');
    if (verdict.status === 'anomaly') expect(verdict.direction).toBe('up');
  });
});
