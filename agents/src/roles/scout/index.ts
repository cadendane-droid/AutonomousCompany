// TIER C: interface only. Scout is Stage 5 work (plan §7.6).
//
// Scout outputs are jobs and external_events rows — never autonomous changes.
// It observes; Builder proposes. That separation is deliberate (spec §9).
import { NotImplementedError } from '@atlas/core';
import type { JobContext, RoleHandlers } from '../types.js';

/**
 * Algorithm-update watch. The scheduled half of this already exists as the
 * external-events ingest connector; what is missing is the judgment layer that
 * decides whether a detected update warrants a freeze.
 */
async function algorithmWatch(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'scout algorithm watch',
    'Stage 5. The external-events connector already files rows; this needs the ' +
      'severity assessment and the freeze escalation path.',
  );
}

/** Competitor page tracking — what changed on the pages that outrank us. */
async function competitorScan(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'scout competitor scan',
    'Stage 5. Needs a competitor registry (which URLs, per cluster) and a ' +
      'fetch-and-diff store. No such registry exists yet.',
  );
}

/**
 * Keyword opportunity scan. The highest-leverage refresh targets are pages at
 * position 8–20 with impressions and no clicks (plan §8.2); those come from
 * Search Console data that is already landing in search_metrics.
 */
async function keywordOpportunities(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'scout keyword opportunity scan',
    'Stage 6, alongside the refresh queue. search_metrics already carries the ' +
      'position and impression data this needs.',
  );
}

/** Reputation monitoring — brand mentions, complaints, review sentiment. */
async function reputationScan(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'scout reputation scan',
    'Stage 5+. Needs a brand name, which is gated on the niche decision ' +
      '(OPEN-QUESTIONS.md §1).',
  );
}

export const scoutHandlers: RoleHandlers = {
  'algorithm-watch': algorithmWatch,
  'competitor-scan': competitorScan,
  'keyword-opportunities': keywordOpportunities,
  'reputation-scan': reputationScan,
};
