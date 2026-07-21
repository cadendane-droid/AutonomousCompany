// TIER A: fully working, no external dependencies.
//
// Rolling 28-day baseline, z-score, day-of-week adjustment, and — most
// importantly — a volume floor below which the metric is declared too noisy
// to evaluate. At 300 sessions/month almost everything is noise; alert on it
// and you train yourself to ignore alerts, which is worse than no alerting
// (plan §7.2).
import { mean, stddev } from './normal.js';

export interface SeriesPoint {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  value: number;
}

export interface AnomalyOptions {
  /** Flag threshold in standard deviations. Spec default: 3. */
  sigma?: number;
  /** Trailing window for the baseline. Spec default: 28 days. */
  baselineDays?: number;
  /**
   * Mean daily volume below which the verdict is 'too-noisy' rather than a
   * z-score. Callers set this per metric; there is no safe universal default,
   * so it is required.
   */
  volumeFloor: number;
  /** Compare against same-weekday history to absorb weekly seasonality. */
  dayOfWeekAdjust?: boolean;
}

export type AnomalyVerdict =
  | { status: 'anomaly'; zScore: number; baselineMean: number; direction: 'up' | 'down' }
  | { status: 'normal'; zScore: number; baselineMean: number }
  | { status: 'too-noisy'; baselineMean: number; volumeFloor: number }
  | { status: 'insufficient-data'; observations: number };

const MIN_BASELINE_POINTS = 8;
const MIN_SAME_WEEKDAY_POINTS = 3;

function weekday(isoDate: string): number {
  // Parse as UTC noon to dodge timezone edge cases.
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/**
 * Evaluate the LAST point of the series against the trailing baseline
 * (which excludes it).
 */
export function detectAnomaly(series: SeriesPoint[], options: AnomalyOptions): AnomalyVerdict {
  const { sigma = 3, baselineDays = 28, volumeFloor, dayOfWeekAdjust = true } = options;
  if (volumeFloor < 0) throw new RangeError('volumeFloor must be >= 0');

  if (series.length < MIN_BASELINE_POINTS + 1) {
    return { status: 'insufficient-data', observations: series.length };
  }

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const today = sorted[sorted.length - 1]!;
  const history = sorted.slice(0, -1).slice(-baselineDays);

  let baseline = history;
  if (dayOfWeekAdjust) {
    const sameWeekday = history.filter((p) => weekday(p.date) === weekday(today.date));
    // Fall back to the full window when weekly history is too thin —
    // a bad adjustment is worse than none.
    if (sameWeekday.length >= MIN_SAME_WEEKDAY_POINTS) baseline = sameWeekday;
  }

  const values = baseline.map((p) => p.value);
  const baselineMean = mean(values);

  // The floor matters more than the detector.
  if (baselineMean < volumeFloor) {
    return { status: 'too-noisy', baselineMean, volumeFloor };
  }

  const sd = stddev(values);
  if (sd === 0) {
    // Perfectly flat history: any change is technically infinite sigma.
    // Treat a change as an anomaly, no change as normal.
    if (today.value === baselineMean) return { status: 'normal', zScore: 0, baselineMean };
    return {
      status: 'anomaly',
      zScore: today.value > baselineMean ? Infinity : -Infinity,
      baselineMean,
      direction: today.value > baselineMean ? 'up' : 'down',
    };
  }

  const zScore = (today.value - baselineMean) / sd;
  if (Math.abs(zScore) >= sigma) {
    return { status: 'anomaly', zScore, baselineMean, direction: zScore > 0 ? 'up' : 'down' };
  }
  return { status: 'normal', zScore, baselineMean };
}
