// TIER B: logic complete, untested against live API (needs a running Postgres).
//
// Write paths for the four metrics tables. Connectors call these; nothing
// else writes metrics. All upserts are idempotent on the natural key so
// re-running an ingest window is safe.
import { withTransaction } from './client.js';
import { query } from './client.js';

export interface SearchMetricRow {
  tenantId: string;
  pageId: string | null;
  date: string; // yyyy-mm-dd
  query: string;
  country: string;
  device: string;
  impressions: number;
  clicks: number;
  position: number | null;
}

export async function upsertSearchMetrics(rows: SearchMetricRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      await client.query(
        `insert into search_metrics (tenant_id, page_id, date, query, country, device,
           impressions, clicks, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (tenant_id, date, page_id, query, country, device)
         do update set impressions = excluded.impressions, clicks = excluded.clicks,
                       position = excluded.position`,
        [r.tenantId, r.pageId, r.date, r.query, r.country, r.device, r.impressions, r.clicks, r.position],
      );
    }
  });
  return rows.length;
}

export interface BehaviorMetricRow {
  tenantId: string;
  pageId: string | null;
  date: string;
  sessions: number | null;
  users: number | null;
  returningUsers: number | null;
  bounceRate: number | null;
  avgDuration: number | null;
  scrollDepthP50: number | null;
  exits: number | null;
}

export async function upsertBehaviorMetrics(rows: BehaviorMetricRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      await client.query(
        `insert into behavior_metrics (tenant_id, page_id, date, sessions, users,
           returning_users, bounce_rate, avg_duration, scroll_depth_p50, exits)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (tenant_id, date, page_id)
         do update set sessions = excluded.sessions, users = excluded.users,
                       returning_users = excluded.returning_users,
                       bounce_rate = excluded.bounce_rate,
                       avg_duration = excluded.avg_duration,
                       scroll_depth_p50 = excluded.scroll_depth_p50,
                       exits = excluded.exits`,
        [r.tenantId, r.pageId, r.date, r.sessions, r.users, r.returningUsers, r.bounceRate, r.avgDuration, r.scrollDepthP50, r.exits],
      );
    }
  });
  return rows.length;
}

export interface AffiliateMetricRow {
  tenantId: string;
  pageId: string | null;
  date: string;
  clicks: number;
  conversions: number;
  revenue: number;
}

export async function upsertAffiliateMetrics(rows: AffiliateMetricRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      await client.query(
        `insert into affiliate_metrics (tenant_id, page_id, date, clicks, conversions, revenue)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (tenant_id, date, page_id)
         do update set clicks = excluded.clicks, conversions = excluded.conversions,
                       revenue = excluded.revenue`,
        [r.tenantId, r.pageId, r.date, r.clicks, r.conversions, r.revenue],
      );
    }
  });
  return rows.length;
}

export interface TechnicalMetricRow {
  tenantId: string;
  pageId: string | null;
  date: string;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  lighthouse: number | null;
  indexed: boolean | null;
  crawlErrors: number | null;
}

export async function upsertTechnicalMetrics(rows: TechnicalMetricRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      await client.query(
        `insert into technical_metrics (tenant_id, page_id, date, lcp, cls, inp,
           lighthouse, indexed, crawl_errors)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (tenant_id, date, page_id)
         do update set lcp = excluded.lcp, cls = excluded.cls, inp = excluded.inp,
                       lighthouse = excluded.lighthouse, indexed = excluded.indexed,
                       crawl_errors = excluded.crawl_errors`,
        [r.tenantId, r.pageId, r.date, r.lcp, r.cls, r.inp, r.lighthouse, r.indexed, r.crawlErrors],
      );
    }
  });
  return rows.length;
}

/** Trailing daily sessions series for a tenant — anomaly detection input. */
export async function dailySessions(
  tenantId: string,
  days: number,
): Promise<Array<{ date: string; sessions: number }>> {
  const rows = await query<{ date: string; sessions: string | null }>(
    `select date::text, sessions::text from v_daily_traffic
     where tenant_id = $1 and date >= current_date - $2::int
     order by date`,
    [tenantId, days],
  );
  return rows.map((r) => ({ date: r.date, sessions: Number(r.sessions ?? 0) }));
}

/** Sustained monthly sessions — the rung-gate measurement input. */
export async function monthlySessions(tenantId: string): Promise<number> {
  const rows = await query<{ total: string | null }>(
    `select sum(sessions)::text as total from v_daily_traffic
     where tenant_id = $1 and date >= current_date - 28`,
    [tenantId],
  );
  return Number(rows[0]?.total ?? 0);
}
