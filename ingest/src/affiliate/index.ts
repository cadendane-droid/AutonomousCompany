// TIER B interface + Tier A CSV reference implementation.
//
// Affiliate programs vary wildly — API, CSV export, or dashboard-only
// (plan §4.2). No program is chosen yet (PLACEHOLDER_PROGRAM), so the
// abstraction is the deliverable: an AffiliateProvider interface plus a
// CSV-import reference implementation any program's export can be massaged
// into. A program without per-page attribution (sub-IDs) cannot inform
// page-level decisions — know that before the first CRO test.
import { readFileSync } from 'node:fs';
import { getPageByPath, upsertAffiliateMetrics, type AffiliateMetricRow } from '@atlas/db';
import type { Connector, ConnectorResult, DateRange } from '../types.js';

export interface AffiliateRecord {
  /** yyyy-mm-dd */
  date: string;
  /** Page slug decoded from the sub-ID parameter; null = unattributable. */
  pagePath: string | null;
  clicks: number;
  conversions: number;
  revenue: number;
}

/** Implement one per program. TODO(setup): add the real PLACEHOLDER_PROGRAM provider. */
export interface AffiliateProvider {
  name: string;
  fetchRecords(range: DateRange): Promise<AffiliateRecord[]>;
}

/**
 * Reference implementation: CSV with header
 *   date,subid,clicks,conversions,revenue
 * where subid encodes the page slug (as emitted by the AffiliateLink
 * component). Point ATLAS_AFFILIATE_CSV at the export file.
 */
export class CsvAffiliateProvider implements AffiliateProvider {
  name = 'csv-import';
  constructor(private readonly csvPath: string) {}

  async fetchRecords(range: DateRange): Promise<AffiliateRecord[]> {
    const raw = readFileSync(this.csvPath, 'utf8');
    const lines = raw.trim().split('\n');
    const header = lines[0]?.toLowerCase().split(',').map((h) => h.trim()) ?? [];
    const col = (name: string) => header.indexOf(name);
    for (const required of ['date', 'subid', 'clicks', 'conversions', 'revenue']) {
      if (col(required) === -1) {
        throw new Error(`affiliate CSV missing required column "${required}" (got: ${header.join(',')})`);
      }
    }

    const records: AffiliateRecord[] = [];
    for (const line of lines.slice(1)) {
      const cells = line.split(',').map((c) => c.trim());
      const date = cells[col('date')] ?? '';
      if (date < range.from || date > range.to) continue;
      const subid = cells[col('subid')] ?? '';
      records.push({
        date,
        // AffiliateLink encodes the slug; reconstruct a path prefix-agnostically.
        pagePath: subid ? `/${subid.replace(/^\/+/, '')}` : null,
        clicks: Number(cells[col('clicks')] ?? 0),
        conversions: Number(cells[col('conversions')] ?? 0),
        revenue: Number(cells[col('revenue')] ?? 0),
      });
    }
    return records;
  }
}

export function affiliateConnector(provider: AffiliateProvider): Connector {
  return {
    name: 'affiliate',
    async run(tenantId: string, range: DateRange): Promise<ConnectorResult> {
      const records = await provider.fetchRecords(range);
      const rows: AffiliateMetricRow[] = [];
      for (const record of records) {
        const page = record.pagePath ? await getPageByPath(tenantId, record.pagePath) : null;
        rows.push({
          tenantId,
          pageId: page?.id ?? null,
          date: record.date,
          clicks: record.clicks,
          conversions: record.conversions,
          revenue: record.revenue,
        });
      }
      return { rowsWritten: await upsertAffiliateMetrics(rows) };
    },
  };
}
