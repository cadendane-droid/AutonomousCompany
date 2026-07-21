// TIER B: logic complete, untested against live API (needs Postgres).
//
// Context assembly (plan §6.x). This module quietly determines output quality
// more than any prompt does: what the model SEES is what it can reason about.
// Per role: relevant metrics, recent decisions, semantic recall of similar
// past decisions (pgvector), brand rules, and the current rung's constraints.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rungDefinition,
  type RoleName,
  type Tenant,
} from '@atlas/core';
import {
  dailySessions,
  monthlySessions,
  recentDecisions,
  similarDecisions,
} from '@atlas/db';

const here = dirname(fileURLToPath(import.meta.url));
// agents/src → repo root
const REPO_ROOT = join(here, '..', '..');

export interface AssembledContext {
  text: string;
}

export interface ContextInput {
  tenant: Tenant;
  role: RoleName;
  /** Free-text description of the task, used for semantic recall. */
  taskSummary: string;
  /** Embedding of taskSummary, if available (semantic recall skipped if not). */
  taskEmbedding?: number[];
}

function section(title: string, body: string): string {
  return `\n## ${title}\n${body.trim()}\n`;
}

export async function assembleContext(input: ContextInput): Promise<AssembledContext> {
  const { tenant, role } = input;
  const parts: string[] = [];

  // 1. The rung and its constraints — every role must know what the maturity
  //    ladder currently permits. This is the difference between an honest
  //    "Measurable: No" and a fabricated experiment.
  const rung = rungDefinition(tenant.rung);
  parts.push(
    section(
      'Current maturity rung',
      [
        `Rung ${rung.rung} (${rung.name}).`,
        `Allowed experiment methods: ${rung.allowedMethods.join(', ')}.`,
        `Max concurrent experiments: ${rung.maxConcurrentExperiments}.`,
        `Knowledge tiers promotable here: ${rung.promotableTiers.join(', ')}.`,
        rung.maxConcurrentExperiments === 0
          ? 'You CANNOT run experiments at this rung. Changes are logged as decisions with honest "Measurable: No".'
          : '',
      ].join(' '),
    ),
  );

  // 2. Traffic reality — what statistics can and cannot see right now.
  const sessions = await monthlySessions(tenant.id).catch(() => 0);
  parts.push(
    section(
      'Traffic',
      `~${sessions} sessions in the trailing 28 days. At this volume, ` +
        (sessions < 1000
          ? 'almost every metric movement is noise; do not attribute causality.'
          : 'directional measurement may be possible for large effects only.'),
    ),
  );

  // 3. Recent metrics summary (role-relevant).
  if (role === 'analyst' || role === 'strategist' || role === 'operator') {
    const series = await dailySessions(tenant.id, 28).catch(() => []);
    if (series.length > 0) {
      parts.push(
        section(
          'Daily sessions (28d)',
          series.map((point) => `${point.date}: ${point.sessions}`).join('\n'),
        ),
      );
    }
  }

  // 4. Recent decisions — Law 6: the log is consulted, not merely accumulated.
  const decisions = await recentDecisions(tenant.id, 10).catch(() => []);
  if (decisions.length > 0) {
    parts.push(
      section(
        'Recent decisions',
        decisions
          .map(
            (decision) =>
              `- [${decision.date.toISOString().slice(0, 10)}] ${decision.summary} ` +
              `(measurable: ${decision.measurable}; outcome: ${decision.outcome ?? 'unreviewed'})`,
          )
          .join('\n'),
      ),
    );
  }

  // 5. Semantic recall — similar past attempts and their outcomes.
  //    Repeating a failed experiment without new justification is a policy
  //    violation (spec §8 rule 4).
  if (input.taskEmbedding) {
    const similar = await similarDecisions(tenant.id, input.taskEmbedding, 5).catch(() => []);
    if (similar.length > 0) {
      parts.push(
        section(
          'Similar past decisions (semantic recall)',
          similar
            .map(
              (decision) =>
                `- ${decision.summary} → ${decision.outcome ?? 'unreviewed'} (distance ${decision.distance.toFixed(3)})`,
            )
            .join('\n'),
        ),
      );
    }
  }

  // 6. Brand rules — constraints that cannot be argued with.
  if (role === 'builder' || role === 'strategist') {
    const brandRules = readFileSync(join(REPO_ROOT, 'brand', 'rules.md'), 'utf8');
    parts.push(section('Brand rules (enforced by the Policy Engine)', brandRules));
  }

  return { text: parts.join('\n') };
}
