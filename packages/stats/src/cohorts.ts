// TIER A: fully working, no external dependencies.
//
// Stratified randomization for split-URL cohorts (spec §5.2, plan §9.1):
// stratify on pre-period impression tertile × page type × cluster, randomize
// within strata, then verify balance on pre-period metrics before launch.
import { mean, stddev } from './normal.js';

export interface CohortPage {
  id: string;
  /** Pre-period impressions (the stratification volume signal). */
  impressions: number;
  pageType: string;
  cluster: string;
}

export interface CohortAssignment {
  treatment: string[];
  control: string[];
  /** strata key → page ids, for auditability. */
  strata: Record<string, string[]>;
}

/** Deterministic PRNG (mulberry32) so assignments are reproducible from a seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tertile boundaries by rank, stable under ties. */
function impressionTertile(sortedImpressions: number[], value: number): 0 | 1 | 2 {
  const n = sortedImpressions.length;
  const idx = sortedImpressions.findIndex((v) => v >= value);
  const rank = idx === -1 ? n - 1 : idx;
  if (rank < n / 3) return 0;
  if (rank < (2 * n) / 3) return 1;
  return 2;
}

export function stratifiedAssign(pages: CohortPage[], seed = 42): CohortAssignment {
  if (pages.length < 2) throw new RangeError('need at least 2 pages to form cohorts');
  const rng = mulberry32(seed);
  const sortedImpressions = pages.map((p) => p.impressions).sort((a, b) => a - b);

  const strata = new Map<string, CohortPage[]>();
  for (const page of pages) {
    const key = [
      `tertile:${impressionTertile(sortedImpressions, page.impressions)}`,
      `type:${page.pageType}`,
      `cluster:${page.cluster}`,
    ].join('|');
    const bucket = strata.get(key) ?? [];
    bucket.push(page);
    strata.set(key, bucket);
  }

  const treatment: string[] = [];
  const control: string[] = [];
  const strataOut: Record<string, string[]> = {};

  for (const [key, bucket] of [...strata.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    strataOut[key] = bucket.map((p) => p.id);
    // Fisher–Yates within stratum, then alternate — guarantees a near-even
    // split inside every stratum rather than merely in expectation.
    const shuffled = [...bucket];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    shuffled.forEach((page, i) => (i % 2 === 0 ? treatment : control).push(page.id));
  }

  return { treatment, control, strata: strataOut };
}

export interface BalanceCheckResult {
  /** Standardized mean difference on the pre-period metric. */
  smd: number;
  treatmentMean: number;
  controlMean: number;
  /** |SMD| <= 0.2 — the conventional negligible-imbalance threshold. */
  balanced: boolean;
}

/**
 * Verify balance on a pre-period metric before launching (plan §9.1: "if the
 * arms differ meaningfully before the change, re-randomize").
 */
export function balanceCheck(treatmentValues: number[], controlValues: number[]): BalanceCheckResult {
  if (treatmentValues.length < 2 || controlValues.length < 2) {
    throw new RangeError('balance check needs at least 2 pages per arm');
  }
  const tMean = mean(treatmentValues);
  const cMean = mean(controlValues);
  const pooledSd = Math.sqrt((stddev(treatmentValues) ** 2 + stddev(controlValues) ** 2) / 2);
  const smd = pooledSd === 0 ? 0 : (tMean - cMean) / pooledSd;
  return {
    smd,
    treatmentMean: tMean,
    controlMean: cMean,
    balanced: Math.abs(smd) <= 0.2,
  };
}
