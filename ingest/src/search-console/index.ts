// TIER B: logic complete, untested against live API.
//
// Google Search Console Search Analytics ingest (plan §4.2):
// service-account JWT auth (no googleapis dependency — RS256 via node:crypto),
// page + query + country + device dimensions, 25k-row pagination, and a
// backfill mode for the initial 16-month pull. GSC data lags 2–3 days; the
// daily schedule requests a lagged window (see runner.ts).
import { createSign } from 'node:crypto';
import { z } from 'zod';
import { requireEnv } from '@atlas/core';
import { getPageByPath, upsertSearchMetrics, type SearchMetricRow } from '@atlas/db';
import type { Connector, ConnectorResult, DateRange } from '../types.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const ROW_LIMIT = 25_000;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/** Service-account JWT → access token (RFC 7523). */
async function getAccessToken(): Promise<string> {
  const clientEmail = requireEnv('GSC_CLIENT_EMAIL');
  const privateKey = requireEnv('GSC_PRIVATE_KEY').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(privateKey).toString('base64url');
  const assertion = `${header}.${claims}.${signature}`;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`GSC token exchange failed: ${response.status} ${await response.text()}`);
  }
  const json = z.object({ access_token: z.string() }).parse(await response.json());
  return json.access_token;
}

const GscRowSchema = z.object({
  keys: z.array(z.string()),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});
const GscResponseSchema = z.object({ rows: z.array(GscRowSchema).optional() });

export const searchConsoleConnector: Connector = {
  name: 'search-console',
  async run(tenantId: string, range: DateRange): Promise<ConnectorResult> {
    const siteUrl = requireEnv('GSC_SITE_URL');
    const token = await getAccessToken();
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

    let startRow = 0;
    let total = 0;
    for (;;) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          startDate: range.from,
          endDate: range.to,
          dimensions: ['date', 'page', 'query', 'country', 'device'],
          rowLimit: ROW_LIMIT,
          startRow,
        }),
      });
      if (!response.ok) {
        throw new Error(`GSC query failed: ${response.status} ${await response.text()}`);
      }
      const data = GscResponseSchema.parse(await response.json());
      const rows = data.rows ?? [];
      if (rows.length === 0) break;

      const metricRows: SearchMetricRow[] = [];
      for (const row of rows) {
        const [date, pageUrl, query, country, device] = row.keys;
        if (!date || !pageUrl) continue;
        const path = new URL(pageUrl).pathname;
        const page = await getPageByPath(tenantId, path);
        metricRows.push({
          tenantId,
          pageId: page?.id ?? null,
          date,
          query: query ?? '',
          country: country ?? '',
          device: device ?? '',
          impressions: row.impressions,
          clicks: row.clicks,
          position: row.position,
        });
      }
      total += await upsertSearchMetrics(metricRows);

      if (rows.length < ROW_LIMIT) break;
      startRow += ROW_LIMIT;
    }

    return { rowsWritten: total };
  },
};

/**
 * Initial backfill: GSC retains only 16 months — pull everything available on
 * first run; that history is free now and gone later (plan §4.2). Runs
 * month-by-month to keep request sizes sane.
 */
export async function backfillSearchConsole(tenantId: string): Promise<number> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3); // data lag
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 16);

  let total = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const monthEnd = new Date(cursor);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const to = monthEnd < end ? monthEnd : end;
    const result = await searchConsoleConnector.run(tenantId, {
      from: cursor.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    total += result.rowsWritten;
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return total;
}
