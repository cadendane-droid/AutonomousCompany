// TIER A: fully working, no external dependencies.
//
// Difference-in-differences for split-URL cohort tests (spec §5.2 step 6,
// "simple difference-in-differences as a floor"). CausalImpact-style BSTS is
// deliberately NOT implemented here — plan §9.2 says use a library, and that
// is Rung 1 work.
import { mean, phiInv, variance } from './normal.js';

export interface DidInput {
  /** Per-page metric values (e.g. clicks/day) in each cell. */
  treatmentPre: number[];
  treatmentPost: number[];
  controlPre: number[];
  controlPost: number[];
  /** Confidence level for the interval, default 0.95. */
  confidence?: number;
}

export interface DidResult {
  /** (T_post − T_pre) − (C_post − C_pre) */
  effect: number;
  standardError: number;
  confidenceInterval: [number, number];
  /** Directional only when true — the honest description at Rung 1. */
  includesZero: boolean;
  treatmentDelta: number;
  controlDelta: number;
}

export function differenceInDifferences(input: DidInput): DidResult {
  const { treatmentPre, treatmentPost, controlPre, controlPost, confidence = 0.95 } = input;
  for (const [name, xs] of Object.entries({ treatmentPre, treatmentPost, controlPre, controlPost })) {
    if (xs.length < 2) {
      throw new RangeError(`${name} needs at least 2 observations, got ${xs.length}`);
    }
  }
  if (confidence <= 0 || confidence >= 1) {
    throw new RangeError(`confidence must be in (0,1), got ${confidence}`);
  }

  const treatmentDelta = mean(treatmentPost) - mean(treatmentPre);
  const controlDelta = mean(controlPost) - mean(controlPre);
  const effect = treatmentDelta - controlDelta;

  // Variance of a difference of four independent sample means.
  const se = Math.sqrt(
    variance(treatmentPost) / treatmentPost.length +
      variance(treatmentPre) / treatmentPre.length +
      variance(controlPost) / controlPost.length +
      variance(controlPre) / controlPre.length,
  );

  const z = phiInv(1 - (1 - confidence) / 2);
  const lo = effect - z * se;
  const hi = effect + z * se;

  return {
    effect,
    standardError: se,
    confidenceInterval: [lo, hi],
    includesZero: lo <= 0 && hi >= 0,
    treatmentDelta,
    controlDelta,
  };
}
