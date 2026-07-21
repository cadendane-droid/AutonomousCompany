// TIER B: logic complete, untested against a live Postgres.
//
// Operator role (plan §6.4): deployments, monitoring, agent health, ingest
// supervision. Mostly scripts, not model calls — the health check below makes
// zero LLM calls by design. Failures raise jobs; severe failures set freeze.
import {
  connectorRowCounts,
  enqueue,
  freeze,
  isFrozen,
  monthSpendUsd,
  monthlySessions,
  query,
} from '@atlas/db';
import { requireEnv, optionalEnv, RUNG_DEFINITIONS } from '@atlas/core';
import type { JobContext, RoleHandlers } from '../types.js';

/** Connectors the health check expects to see fresh data from (plan §4.3). */
const EXPECTED_CONNECTORS = [
  'search-console',
  'posthog',
  'affiliate',
  'technical',
  'external-events',
] as const;

/** Hours after which a connector's last successful run counts as stale. */
const STALE_AFTER_HOURS = 36;

export interface HealthFinding {
  check: string;
  severity: 'info' | 'warn' | 'severe';
  message: string;
}

/**
 * Ingest freshness: when did each connector last succeed, and did the latest
 * run collapse to zero rows where it previously produced many? A connector
 * that silently stops is worse than one that never existed, because the gap
 * gets trusted as a real signal (plan §4.3).
 */
async function checkIngestFreshness(tenantId: string): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];

  const rows = await query<{ connector: string; last_ok: Date | null }>(
    `select connector, max(started_at) filter (where status = 'ok') as last_ok
       from ingest_runs
      where tenant_id = $1
      group by connector`,
    [tenantId],
  );
  const lastOk = new Map(rows.map((r) => [r.connector, r.last_ok]));

  for (const connector of EXPECTED_CONNECTORS) {
    const seen = lastOk.get(connector) ?? null;
    if (seen === null) {
      findings.push({
        check: 'ingest-freshness',
        severity: 'warn',
        message: `connector '${connector}' has never completed successfully`,
      });
      continue;
    }

    const ageHours = (Date.now() - new Date(seen).getTime()) / 3_600_000;
    if (ageHours > STALE_AFTER_HOURS) {
      findings.push({
        check: 'ingest-freshness',
        severity: 'severe',
        message: `connector '${connector}' last succeeded ${ageHours.toFixed(0)}h ago (stale past ${STALE_AFTER_HOURS}h)`,
      });
    }

    // Row-count collapse: a zero is a value, a missing row is not.
    const counts = await connectorRowCounts(connector);
    if (counts.latest === 0 && (counts.trailingAvg ?? 0) > 10) {
      findings.push({
        check: 'ingest-row-counts',
        severity: 'severe',
        message: `connector '${connector}' wrote 0 rows; trailing average ${counts.trailingAvg?.toFixed(0)}`,
      });
    }
  }

  return findings;
}

/** Agent error rate over the trailing day. */
async function checkAgentHealth(tenantId: string): Promise<HealthFinding[]> {
  const rows = await query<{ total: string; errors: string }>(
    `select count(*)::text as total,
            count(*) filter (where outcome = 'error')::text as errors
       from agent_runs
      where tenant_id = $1 and created_at >= now() - interval '1 day'`,
    [tenantId],
  );
  const total = Number(rows[0]?.total ?? 0);
  const errors = Number(rows[0]?.errors ?? 0);
  if (total === 0) return [];

  const rate = errors / total;
  if (rate > 0.25) {
    return [
      {
        check: 'agent-error-rate',
        severity: 'severe',
        message: `${errors}/${total} agent runs errored in 24h (${(rate * 100).toFixed(0)}%)`,
      },
    ];
  }
  if (rate > 0.1) {
    return [
      {
        check: 'agent-error-rate',
        severity: 'warn',
        message: `${errors}/${total} agent runs errored in 24h (${(rate * 100).toFixed(0)}%)`,
      },
    ];
  }
  return [];
}

/**
 * Spend against the monthly cap. The router degrades to cheaper tiers as the
 * cap approaches and hard-stops at it; this check exists so a human sees it
 * coming rather than discovering it from a stalled queue (plan §13).
 */
async function checkBudget(): Promise<HealthFinding[]> {
  const cap = Number(optionalEnv('ATLAS_LLM_MONTHLY_BUDGET_USD', '50'));
  const spend = await monthSpendUsd();
  const fraction = cap > 0 ? spend / cap : 0;

  if (fraction >= 1) {
    return [
      {
        check: 'llm-budget',
        severity: 'severe',
        message: `LLM spend $${spend.toFixed(2)} has reached the $${cap.toFixed(2)} monthly cap; router is hard-stopped`,
      },
    ];
  }
  if (fraction >= 0.8) {
    return [
      {
        check: 'llm-budget',
        severity: 'warn',
        message: `LLM spend $${spend.toFixed(2)} is ${(fraction * 100).toFixed(0)}% of the $${cap.toFixed(2)} cap; router degrading to cheaper tiers`,
      },
    ];
  }
  return [];
}

/** Indexation coverage: pages known to the site vs pages Search Console reports. */
async function checkIndexCoverage(tenantId: string): Promise<HealthFinding[]> {
  const rows = await query<{ total: string; indexed: string }>(
    `select count(*)::text as total,
            count(*) filter (where t.indexed)::text as indexed
       from pages p
       left join lateral (
         select indexed from technical_metrics
          where page_id = p.id order by date desc limit 1
       ) t on true
      where p.tenant_id = $1`,
    [tenantId],
  );
  const total = Number(rows[0]?.total ?? 0);
  const indexed = Number(rows[0]?.indexed ?? 0);
  if (total < 10) return []; // too few pages for the ratio to mean anything

  const coverage = indexed / total;
  if (coverage < 0.7) {
    return [
      {
        check: 'index-coverage',
        severity: 'severe',
        message: `only ${indexed}/${total} pages indexed (${(coverage * 100).toFixed(0)}%)`,
      },
    ];
  }
  return [];
}

/**
 * Backup verification. Supabase runs managed backups; this asserts the project
 * is configured for them rather than performing a restore.
 * TODO(setup): once the Supabase project exists, replace this with a real
 * check against the Management API (see OPEN-QUESTIONS.md §3).
 */
async function checkBackups(): Promise<HealthFinding[]> {
  const configured = process.env['SUPABASE_PROJECT_REF'];
  if (!configured) {
    return [
      {
        check: 'backups',
        severity: 'warn',
        message:
          'SUPABASE_PROJECT_REF not set — backup verification not wired. TODO(setup): configure and verify managed backups.',
      },
    ];
  }
  return [];
}

/** Rung sanity: has traffic outgrown the recorded rung? Never auto-promotes. */
async function checkRung(tenantId: string, rung: number): Promise<HealthFinding[]> {
  const sessions = await monthlySessions(tenantId);
  const next = RUNG_DEFINITIONS[(rung + 1) as 1 | 2 | 3];
  if (!next) return [];

  if (sessions >= next.minMonthlySessions) {
    return [
      {
        check: 'rung',
        severity: 'info',
        message:
          `trailing-month sessions ${sessions.toFixed(0)} meet the Rung ${next.rung} ` +
          `threshold (${next.minMonthlySessions}). Promotion is a deliberate human act ` +
          `after the sustained-8-weeks and page-inventory conditions are checked: ${next.entryConditions.join('; ')}`,
      },
    ];
  }
  return [];
}

/**
 * Nightly health check. Composes every sub-check, raises an investigation job
 * for anything at warn or above, and freezes the tenant on a severe finding.
 */
async function healthCheck(ctx: JobContext): Promise<string> {
  const tenantId = ctx.tenant.id;

  const findings: HealthFinding[] = [
    ...(await checkIngestFreshness(tenantId)),
    ...(await checkAgentHealth(tenantId)),
    ...(await checkBudget()),
    ...(await checkIndexCoverage(tenantId)),
    ...(await checkBackups()),
    ...(await checkRung(tenantId, ctx.tenant.rung)),
  ];

  const severe = findings.filter((f) => f.severity === 'severe');
  const actionable = findings.filter((f) => f.severity !== 'info');

  if (actionable.length > 0) {
    await enqueue({
      tenantId,
      role: 'analyst',
      kind: 'investigate',
      priority: severe.length > 0 ? 1 : 5,
      payload: {
        source: 'operator-health-check',
        findings: actionable,
      },
    });
  }

  if (severe.length > 0 && !(await isFrozen(tenantId))) {
    // Freezing is cheap; unfreezing requires a deliberate human act (§5.4).
    await freeze(
      tenantId,
      `operator health check: ${severe.map((f) => f.message).join('; ')}`,
      'operator',
    );
    return `FROZE tenant on ${severe.length} severe finding(s); ${actionable.length} raised for investigation`;
  }

  return findings.length === 0
    ? 'healthy: no findings'
    : `${findings.length} finding(s), ${severe.length} severe: ${findings.map((f) => f.message).join('; ')}`;
}

/**
 * Return stuck jobs to the queue. Scheduled alongside the health check so a
 * worker that died mid-job does not park work forever.
 */
async function reapJobs(): Promise<string> {
  const { reapStale } = await import('@atlas/db');
  const count = await reapStale();
  return `reaped ${count} stale job(s)`;
}

/**
 * Assert the deploy target is reachable before an agent proposes changes
 * against it. TIER B — the Vercel API shape is implemented from docs.
 */
async function verifyDeployTarget(): Promise<string> {
  const token = requireEnv('VERCEL_TOKEN');
  const projectId = requireEnv('VERCEL_PROJECT_ID');
  const teamId = process.env['VERCEL_TEAM_ID'];
  const url = new URL(`https://api.vercel.com/v9/projects/${projectId}`);
  if (teamId) url.searchParams.set('teamId', teamId);

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Vercel project check failed: ${response.status} ${await response.text()}`);
  }
  return `deploy target reachable: project ${projectId}`;
}

export const operatorHandlers: RoleHandlers = {
  'health-check': healthCheck,
  'reap-jobs': reapJobs,
  'verify-deploy-target': verifyDeployTarget,
};
