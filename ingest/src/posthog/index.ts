// TIER B: logic complete, untested against live API.
//
// Nightly aggregation of PostHog events into behavior_metrics (plan §4.2).
// Uses the HogQL query API with the personal API key. The site snippet
// (project API key) collects; this connector aggregates.
import { z } from 'zod';
import { optionalEnv, requireEnv } from '@atlas/core';
import { getPageByPath, upsertBehaviorMetrics, type BehaviorMetricRow } from '@atlas/db';
import type { Connector, ConnectorResult, DateRange } from '../types.js';

const QueryResponseSchema = z.object({
  results: z.array(z.array(z.unknown())),
});

async function hogql(query: string): Promise<unknown[][]> {
  const host = optionalEnv('POSTHOG_HOST', 'https://us.posthog.com');
  const projectId = requireEnv('POSTHOG_PROJECT_ID');
  const apiKey = requireEnv('POSTHOG_PERSONAL_API_KEY');

  const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!response.ok) {
    throw new Error(`PostHog query failed: ${response.status} ${await response.text()}`);
  }
  return QueryResponseSchema.parse(await response.json()).results;
}

export const posthogConnector: Connector = {
  name: 'posthog',
  async run(tenantId: string, range: DateRange): Promise<ConnectorResult> {
    // Per-day, per-path aggregation. Session-level metrics come from the
    // sessions table; pageview-level from events.
    // TODO(setup): once PostHog is live, verify these property names against
    // the actual event payloads (autocapture pathname property in particular).
    const results = await hogql(`
      select
        toDate(timestamp) as day,
        properties.$pathname as path,
        count(distinct $session_id) as sessions,
        count(distinct person_id) as users,
        avg(properties.$prev_pageview_max_scroll_percentage) as scroll_p50
      from events
      where event = '$pageview'
        and timestamp >= toDate('${range.from}')
        and timestamp < toDate('${range.to}') + interval 1 day
      group by day, path
      order by day
    `);

    const rows: BehaviorMetricRow[] = [];
    for (const result of results) {
      const [day, path, sessions, users, scrollP50] = result;
      if (typeof day !== 'string' || typeof path !== 'string') continue;
      const page = await getPageByPath(tenantId, path);
      rows.push({
        tenantId,
        pageId: page?.id ?? null,
        date: day.slice(0, 10),
        sessions: Number(sessions ?? 0),
        users: Number(users ?? 0),
        // Requires cohort/person analysis not aggregated here yet:
        returningUsers: null,
        bounceRate: null, // TODO(setup): derive from session table once web analytics is enabled
        avgDuration: null,
        scrollDepthP50: scrollP50 == null ? null : Number(scrollP50),
        exits: null,
      });
    }

    return { rowsWritten: await upsertBehaviorMetrics(rows) };
  },
};
