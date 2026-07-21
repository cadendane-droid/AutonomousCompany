// TIER C: interface only. Analyst is Stage 5 work (plan §7) and every handler
// below throws rather than returning a plausible-looking answer, because a
// measurement stub that silently returns something is exactly how a knowledge
// base fills with manufactured confidence (Law 9).
//
// The statistics these handlers will call are already built and tested in
// packages/stats — health-score, anomaly, did, power. What is missing is the
// wiring: which series feed which detector, and what a confirmed anomaly does.
import { NotImplementedError } from '@atlas/core';
import type { JobContext, RoleHandlers } from '../types.js';

/**
 * Daily health snapshot (plan §7.1). Reads component readings from
 * v_health_components, calls computeHealthScore with the tenant's rung
 * weights, and stores components separately so the composite can be
 * recomputed if weights change.
 */
async function healthSnapshot(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'analyst health snapshot',
    'Stage 5. computeHealthScore in packages/stats is built and tested; this needs ' +
      'the v_health_components read plus a health_snapshots table to write to.',
  );
}

/**
 * Anomaly sweep (plan §7.2). Rolling 28-day baseline per metric, flag at 3σ,
 * day-of-week adjusted, with a volume floor below which the metric is declared
 * too noisy to evaluate. Confirmed anomalies raise investigation jobs and,
 * above the severity threshold, set freeze.
 */
async function anomalySweep(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'analyst anomaly sweep',
    'Stage 5. detectAnomaly in packages/stats is built and tested, volume floor ' +
      'included; this needs the per-metric series queries and the freeze wiring.',
  );
}

/**
 * Investigate a finding raised by the Operator health check or an anomaly.
 * Per spec §12, investigation precedes hypothesis: establish whether the cause
 * was internal or external before proposing anything.
 */
async function investigate(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'analyst investigation',
    'Stage 5. Needs the decision-log-vs-timeline comparison and the external_events ' +
      'confounder read. Until then, findings land in the job payload for a human.',
  );
}

/**
 * Experiment design and evaluation. Deliberately unreachable until Rung 1 —
 * at Rung 0 there is no traffic to power anything, and the Policy Engine's
 * power check rejects such proposals at the gate anyway (spec §4).
 */
async function designExperiment(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'analyst experiment design',
    'Rung 1 (1,000+ sessions/month sustained 8 weeks AND 100+ comparable pages). ' +
      'Not a Stage-5 gap — this is gated on traffic, not on build effort.',
  );
}

export const analystHandlers: RoleHandlers = {
  'health-snapshot': healthSnapshot,
  'anomaly-sweep': anomalySweep,
  investigate,
  'design-experiment': designExperiment,
};
