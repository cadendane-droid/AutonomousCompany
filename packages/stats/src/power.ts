// TIER A: fully working, no external dependencies. Unit tested against the
// effect-size table in spec §4.
//
// This is the code that keeps the knowledge base honest. The Policy Engine
// calls achievablePower() to reject underpowered experiments at the gate
// (Law 9): an underpowered test that "wins" is more likely noise than signal,
// and it would enter the knowledge base as a lie.
import { DEFAULT_ALPHA, DEFAULT_POWER } from '@atlas/core';
import { phi, phiInv } from './normal.js';

export interface PowerInput {
  /** Baseline conversion/click rate, e.g. 0.05. */
  baselineRate: number;
  /** Relative MDE, e.g. 0.25 for a 25% relative lift. */
  mde: number;
  alpha?: number;
  power?: number;
}

function validateRates(baselineRate: number, mde: number): number {
  if (baselineRate <= 0 || baselineRate >= 1) {
    throw new RangeError(`baselineRate must be in (0,1), got ${baselineRate}`);
  }
  if (mde <= 0) throw new RangeError(`mde must be > 0, got ${mde}`);
  const treatmentRate = baselineRate * (1 + mde);
  if (treatmentRate >= 1) {
    throw new RangeError(
      `baselineRate ${baselineRate} with relative mde ${mde} implies rate >= 1`,
    );
  }
  return treatmentRate;
}

/**
 * Rule-of-thumb sample size per arm: n ≈ 16σ²/δ², with σ² = p(1−p) at the
 * baseline rate. This is the spec §4 baseline formula and reproduces its
 * table (80% power, α = 0.05, two-sided).
 */
export function sampleSizeRuleOfThumb(baselineRate: number, mde: number): number {
  validateRates(baselineRate, mde);
  const sigma2 = baselineRate * (1 - baselineRate);
  const delta = baselineRate * mde;
  return Math.ceil((16 * sigma2) / (delta * delta));
}

/**
 * Proper normal-approximation sample size for a two-proportion z-test:
 * n = (z_{1−α/2}·√(2·p̄·q̄) + z_{power}·√(p₁q₁ + p₂q₂))² / δ²
 */
export function sampleSizeNormalApprox(input: PowerInput): number {
  const { baselineRate, mde, alpha = DEFAULT_ALPHA, power = DEFAULT_POWER } = input;
  const p2 = validateRates(baselineRate, mde);
  const p1 = baselineRate;
  const delta = p2 - p1;
  const pBar = (p1 + p2) / 2;
  const zAlpha = phiInv(1 - alpha / 2);
  const zBeta = phiInv(power);
  const numerator =
    zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((numerator * numerator) / (delta * delta));
}

export interface AchievablePowerInput {
  baselineRate: number;
  /** Relative MDE the proposal claims it will detect. */
  mde: number;
  /** Sessions (or impressions) available per arm per day. */
  trafficPerArm: number;
  durationDays: number;
  alpha?: number;
}

export interface AchievablePowerResult {
  /** Probability of detecting the stated MDE if it is real. */
  power: number;
  nPerArm: number;
  requiredNPerArm: number;
  /** True when power >= 0.8 — the Policy Engine's pass condition. */
  adequatelyPowered: boolean;
}

/**
 * What the Policy Engine calls. Given the traffic the proposal actually has,
 * what is the probability the test detects its own stated effect?
 * Below 0.8 the proposal is rejected at the gate.
 */
export function achievablePower(input: AchievablePowerInput): AchievablePowerResult {
  const { baselineRate, mde, trafficPerArm, durationDays, alpha = DEFAULT_ALPHA } = input;
  const p2 = validateRates(baselineRate, mde);
  if (trafficPerArm < 0 || durationDays <= 0) {
    throw new RangeError('trafficPerArm must be >= 0 and durationDays > 0');
  }
  const p1 = baselineRate;
  const nPerArm = Math.floor(trafficPerArm * durationDays);
  const requiredNPerArm = sampleSizeNormalApprox({ baselineRate, mde, alpha });

  if (nPerArm === 0) {
    return { power: 0, nPerArm, requiredNPerArm, adequatelyPowered: false };
  }

  const delta = p2 - p1;
  const se = Math.sqrt((p1 * (1 - p1)) / nPerArm + (p2 * (1 - p2)) / nPerArm);
  const zAlpha = phiInv(1 - alpha / 2);
  const power = phi(delta / se - zAlpha);

  return {
    power,
    nPerArm,
    requiredNPerArm,
    adequatelyPowered: power >= DEFAULT_POWER,
  };
}
