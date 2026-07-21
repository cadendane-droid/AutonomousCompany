// TIER B: logic complete, untested against live API (needs a running Postgres).
import { query } from './client.js';

export async function startIngestRun(input: {
  tenantId: string | null;
  connector: string;
  dateFrom: string | null;
  dateTo: string | null;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into ingest_runs (tenant_id, connector, date_from, date_to)
     values ($1, $2, $3, $4) returning id`,
    [input.tenantId, input.connector, input.dateFrom, input.dateTo],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('startIngestRun: insert returned no id');
  return id;
}

export async function finishIngestRun(id: string, rowsWritten: number): Promise<void> {
  await query(
    `update ingest_runs set status = 'ok', finished_at = now(), rows_written = $2 where id = $1`,
    [id, rowsWritten],
  );
}

export async function failIngestRun(id: string, error: string): Promise<void> {
  await query(
    `update ingest_runs set status = 'failed', finished_at = now(), error = $2 where id = $1`,
    [id, error],
  );
}

/**
 * Staleness check (plan §13: "a connector fails silently and you trust the
 * gap"). Returns the trailing average row count and the most recent count so
 * the runner can flag a suspicious zero. A zero is a value; a missing row is not.
 */
export async function connectorRowCounts(
  connector: string,
  trailingRuns = 7,
): Promise<{ latest: number | null; trailingAvg: number | null }> {
  const rows = await query<{ rows_written: number | null }>(
    `select rows_written from ingest_runs
     where connector = $1 and status = 'ok'
     order by started_at desc limit $2`,
    [connector, trailingRuns],
  );
  if (rows.length === 0) return { latest: null, trailingAvg: null };
  const counts = rows.map((r) => r.rows_written ?? 0);
  const latest = counts[0] ?? null;
  const rest = counts.slice(1);
  const trailingAvg = rest.length ? rest.reduce((a, b) => a + b, 0) / rest.length : null;
  return { latest, trailingAvg };
}
