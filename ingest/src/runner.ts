// TIER B: logic complete, untested against live API.
//
// Connector dispatch (plan §4.3): every run writes ingest_runs with status and
// row counts; retry with backoff; and the staleness assertion — a connector
// that produces zero rows where it previously produced many raises an
// operator job, because a silent gap will later be trusted as a real signal.
//
// Usage: pnpm --filter @atlas/ingest run --connector search-console [--tenant tenant-alpha]
//        [--from 2026-07-01 --to 2026-07-18] [--backfill]
import process from 'node:process';
import { DEFAULT_TENANT_SLUG } from '@atlas/core';
import {
  closePool,
  connectorRowCounts,
  enqueue,
  failIngestRun,
  finishIngestRun,
  getTenantBySlug,
  startIngestRun,
} from '@atlas/db';
import type { Connector, DateRange } from './types.js';
import { backfillSearchConsole, searchConsoleConnector } from './search-console/index.js';
import { posthogConnector } from './posthog/index.js';
import { affiliateConnector, CsvAffiliateProvider } from './affiliate/index.js';
import { technicalConnector } from './technical/index.js';
import { externalEventsConnector } from './external-events/index.js';

const MAX_ATTEMPTS = 3;
/** GSC data lags 2–3 days; default daily window ends 3 days ago. */
const GSC_LAG_DAYS = 3;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function defaultRange(connectorName: string): DateRange {
  if (connectorName === 'search-console') {
    return { from: isoDaysAgo(GSC_LAG_DAYS + 1), to: isoDaysAgo(GSC_LAG_DAYS) };
  }
  return { from: isoDaysAgo(1), to: isoDaysAgo(1) };
}

function buildConnectors(): Record<string, Connector> {
  const connectors: Record<string, Connector> = {
    'search-console': searchConsoleConnector,
    posthog: posthogConnector,
    technical: technicalConnector,
    'external-events': externalEventsConnector,
  };
  // TODO(setup): replace the CSV provider with the real PLACEHOLDER_PROGRAM
  // provider once an affiliate program is chosen.
  const csvPath = process.env.ATLAS_AFFILIATE_CSV;
  if (csvPath) connectors.affiliate = affiliateConnector(new CsvAffiliateProvider(csvPath));
  return connectors;
}

export async function runConnector(
  connector: Connector,
  tenantId: string,
  range: DateRange,
): Promise<void> {
  const runId = await startIngestRun({
    tenantId,
    connector: connector.name,
    dateFrom: range.from,
    dateTo: range.to,
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await connector.run(tenantId, range);
      await finishIngestRun(runId, result.rowsWritten);
      await assertNotStale(connector.name, tenantId, result.rowsWritten);
      console.log(`${connector.name}: ok, ${result.rowsWritten} rows (${range.from}..${range.to})`);
      return;
    } catch (err) {
      lastError = err;
      const backoffMs = 2 ** attempt * 1000;
      console.error(`${connector.name}: attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err}`);
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  await failIngestRun(runId, lastError instanceof Error ? lastError.message : String(lastError));
  throw lastError;
}

/**
 * Plan §13: "a connector fails silently and you trust the gap." A zero-row run
 * against a healthy trailing average raises an operator job — a zero is a
 * value, and it needs eyes.
 */
async function assertNotStale(connectorName: string, tenantId: string, latest: number): Promise<void> {
  const { trailingAvg } = await connectorRowCounts(connectorName);
  if (latest === 0 && trailingAvg !== null && trailingAvg >= 10) {
    await enqueue({
      tenantId,
      role: 'operator',
      kind: 'investigate-stale-connector',
      payload: { connector: connectorName, trailingAvg },
      priority: 2,
    });
    console.warn(
      `${connectorName}: 0 rows vs trailing avg ${trailingAvg.toFixed(0)} — operator job raised`,
    );
  }
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const tenantSlug = arg('tenant') ?? DEFAULT_TENANT_SLUG;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new Error(`tenant "${tenantSlug}" not found — run pnpm db:seed first`);
  }

  const connectors = buildConnectors();
  const requested = arg('connector');

  if (process.argv.includes('--backfill')) {
    const rows = await backfillSearchConsole(tenant.id);
    console.log(`search-console backfill: ${rows} rows`);
    return;
  }

  const toRun = requested
    ? [connectors[requested] ?? (() => { throw new Error(`unknown connector "${requested}" (have: ${Object.keys(connectors).join(', ')})`); })()]
    : Object.values(connectors);

  let failures = 0;
  for (const connector of toRun) {
    const range: DateRange =
      arg('from') && arg('to') ? { from: arg('from')!, to: arg('to')! } : defaultRange(connector.name);
    try {
      await runConnector(connector as Connector, tenant.id, range);
    } catch {
      failures++;
    }
  }
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
