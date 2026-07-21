// TIER C: interface only. Strategist is Stage 6 work (plan §8.3).
//
// Note on judging this role when it is built: if the roadmap is consistently
// wrong, the problem is context assembly, not model capability. Fix what it
// sees before reaching for a bigger model (plan §8.3).
import { NotImplementedError } from '@atlas/core';
import type { JobContext, RoleHandlers } from '../types.js';

/**
 * Weekly roadmap generation from health-score trends, the refresh queue, Scout
 * opportunities, the decision log, and the current rung's constraints. Output
 * is a prioritized job list with reasoning, written to `roadmaps`.
 *
 * Blocked on more than effort: there is no `roadmaps` table yet (it is Stage 6,
 * deliberately not in migrations 0001–0013), and the inputs it synthesizes —
 * health snapshots, refresh queue, Scout findings — are themselves Tier C.
 */
async function generateRoadmap(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'strategist roadmap generation',
    'Stage 6. Requires a roadmaps table (not yet migrated) plus working Analyst ' +
      'health snapshots and Scout opportunities, all of which are Tier C today.',
  );
}

/**
 * Weekly review: what shipped, what moved, what the decision log says about
 * changes now old enough to read (spec §10 measurement cadence — nothing
 * concludes on the weekly clock).
 */
async function weeklyReview(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'strategist weekly review',
    'Stage 6. Needs decisions with recorded outcomes, which needs Stage 5 first.',
  );
}

/**
 * Propose a rung promotion for human decision. Never promotes autonomously —
 * the rung gates every statistical claim the system is permitted to make, and
 * a self-promoting system would route around Law 9 entirely.
 */
async function proposeRungChange(_ctx: JobContext): Promise<string> {
  throw new NotImplementedError(
    'strategist rung promotion proposal',
    'Stage 6. By design this only ever produces a recommendation for a human; ' +
      'setTenantRung is never called from an agent path.',
  );
}

export const strategistHandlers: RoleHandlers = {
  'generate-roadmap': generateRoadmap,
  'weekly-review': weeklyReview,
  'propose-rung-change': proposeRungChange,
};
