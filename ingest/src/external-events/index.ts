// TIER B: logic complete, untested against live API.
//
// External events — the confounder record every future measurement depends on
// (plan §4.1). Scheduled check of the Google Search Status dashboard, plus a
// programmatic entry point the manual CLI (scripts/events-add.ts) uses.
// Semi-manual is fine and honest; make manual entry EASY.
import { z } from 'zod';
import { query } from '@atlas/db';
import type { Connector, ConnectorResult, DateRange } from '../types.js';

const INCIDENTS_URL = 'https://status.search.google.com/incidents.json';

const IncidentSchema = z.object({
  id: z.string().or(z.number()).transform(String),
  begin: z.string(),
  end: z.string().nullable().optional(),
  external_desc: z.string().optional(),
  affected_products: z.array(z.object({ title: z.string() })).optional(),
});

export async function addExternalEvent(input: {
  tenantId: string | null;
  date: string;
  kind: 'algo_update' | 'seasonal' | 'competitor' | 'program_change' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  source: string;
}): Promise<void> {
  await query(
    `insert into external_events (tenant_id, date, kind, description, severity, source)
     values ($1, $2, $3, $4, $5, $6)`,
    [input.tenantId, input.date, input.kind, input.description, input.severity, input.source],
  );
}

export const externalEventsConnector: Connector = {
  name: 'external-events',
  async run(_tenantId: string, range: DateRange): Promise<ConnectorResult> {
    const response = await fetch(INCIDENTS_URL);
    if (!response.ok) {
      throw new Error(`Google Search Status fetch failed: ${response.status}`);
    }
    const incidents = z.array(IncidentSchema).parse(await response.json());

    let written = 0;
    for (const incident of incidents) {
      const beginDate = incident.begin.slice(0, 10);
      if (beginDate < range.from || beginDate > range.to) continue;

      // Idempotent on source id — re-runs don't duplicate confounders.
      const existing = await query<{ id: string }>(
        `select id from external_events where source = $1`,
        [`google-search-status:${incident.id}`],
      );
      if (existing.length > 0) continue;

      await addExternalEvent({
        tenantId: null, // platform-wide
        date: beginDate,
        kind: 'algo_update',
        description:
          incident.external_desc ??
          `Google Search incident (${incident.affected_products?.map((p) => p.title).join(', ') ?? 'unspecified'})`,
        severity: 'high',
        source: `google-search-status:${incident.id}`,
      });
      written++;
    }
    return { rowsWritten: written };
  },
};
