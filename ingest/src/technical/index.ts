// TIER B: logic complete, untested against live API.
//
// Technical metrics (plan §4.2): lab data from a scheduled Lighthouse run
// over a sample of page types, field CWV from Vercel Speed Insights.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { optionalEnv, requireEnv } from '@atlas/core';
import { getPageByPath, listPages, upsertTechnicalMetrics, type TechnicalMetricRow } from '@atlas/db';
import type { Connector, ConnectorResult, DateRange } from '../types.js';

const execFileAsync = promisify(execFile);

const LighthouseResultSchema = z.object({
  categories: z.object({ performance: z.object({ score: z.number().nullable() }) }),
  audits: z.object({
    'largest-contentful-paint': z.object({ numericValue: z.number().optional() }),
    'cumulative-layout-shift': z.object({ numericValue: z.number().optional() }),
  }),
});

/** One page per type — lab data on a representative sample, not every page. */
async function samplePaths(tenantId: string): Promise<string[]> {
  const pages = await listPages(tenantId);
  const byType = new Map<string, string>();
  for (const page of pages) {
    if (!byType.has(page.type)) byType.set(page.type, page.path);
  }
  return ['/', ...byType.values()];
}

export const technicalConnector: Connector = {
  name: 'technical',
  async run(tenantId: string, range: DateRange): Promise<ConnectorResult> {
    const baseUrl = requireEnv('SITE_BASE_URL');
    const rows: TechnicalMetricRow[] = [];

    for (const path of await samplePaths(tenantId)) {
      const url = new URL(path, baseUrl).toString();
      // Runs the lighthouse CLI (installed transiently via npx in CI).
      // TODO(setup): the lighthouse.yml workflow installs chrome; locally you
      // need Chrome/Chromium on PATH.
      const { stdout } = await execFileAsync(
        'npx',
        ['--yes', 'lighthouse', url, '--output=json', '--quiet', '--chrome-flags=--headless'],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      const result = LighthouseResultSchema.parse(JSON.parse(stdout));
      const page = await getPageByPath(tenantId, path);
      rows.push({
        tenantId,
        pageId: page?.id ?? null,
        date: range.to,
        lcp: result.audits['largest-contentful-paint'].numericValue ?? null,
        cls: result.audits['cumulative-layout-shift'].numericValue ?? null,
        inp: null, // INP is a field metric; comes from Speed Insights below
        lighthouse: result.categories.performance.score === null
          ? null
          : Math.round(result.categories.performance.score * 100),
        indexed: null,
        crawlErrors: null,
      });
    }

    let written = await upsertTechnicalMetrics(rows);
    written += await ingestSpeedInsights(tenantId, range).catch((err) => {
      // Field data is additive; a Speed Insights failure shouldn't void lab data,
      // but it must be visible.
      console.error(`speed-insights ingest failed (lab data still written): ${err}`);
      return 0;
    });
    return { rowsWritten: written };
  },
};

const SpeedInsightsSchema = z.object({
  data: z
    .array(
      z.object({
        path: z.string().optional(),
        p75_lcp: z.number().optional(),
        p75_cls: z.number().optional(),
        p75_inp: z.number().optional(),
      }),
    )
    .optional(),
});

/**
 * Vercel Speed Insights field CWV.
 * TODO(setup): verify the endpoint shape against the current Vercel API once
 * a project exists — documented shapes for this endpoint have changed before.
 */
async function ingestSpeedInsights(tenantId: string, range: DateRange): Promise<number> {
  const token = requireEnv('VERCEL_TOKEN');
  const projectId = requireEnv('VERCEL_PROJECT_ID');
  const teamId = optionalEnv('VERCEL_TEAM_ID', '');

  const url = new URL(`https://api.vercel.com/v1/speed-insights/${projectId}/metrics`);
  url.searchParams.set('from', range.from);
  url.searchParams.set('to', range.to);
  if (teamId) url.searchParams.set('teamId', teamId);

  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Speed Insights failed: ${response.status} ${await response.text()}`);
  }
  const parsed = SpeedInsightsSchema.parse(await response.json());
  const rows: TechnicalMetricRow[] = [];
  for (const entry of parsed.data ?? []) {
    if (!entry.path) continue;
    const page = await getPageByPath(tenantId, entry.path);
    rows.push({
      tenantId,
      pageId: page?.id ?? null,
      date: range.to,
      lcp: entry.p75_lcp ?? null,
      cls: entry.p75_cls ?? null,
      inp: entry.p75_inp ?? null,
      lighthouse: null,
      indexed: null,
      crawlErrors: null,
    });
  }
  return upsertTechnicalMetrics(rows);
}
