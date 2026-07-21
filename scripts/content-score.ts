// TIER B: logic complete, untested against a live API (needs ANTHROPIC_API_KEY).
//
// Score content against brand/quality-rubric.md (plan §8.1). Prints scores and,
// with --write, stores them on the pages row.
//
// A caveat that matters more than the code: an unanchored LLM rubric drifts
// toward scoring everything a 4. The rubric file carries human-scored
// calibration examples for exactly this reason, and the scores this produces
// must be validated against your own scoring on a holdout before they are
// trusted to drive the refresh queue. A broken quality score is worse than
// none, because it silently misprioritizes every refresh decision.
//
// Usage: pnpm content:score [--dir site/src/content/tenant-alpha] [--write]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { z } from 'zod';
import { callLlmStructured } from '@atlas/llm';
import { getPageByPath, getTenantBySlug, setQualityScore } from '@atlas/db';
import { DEFAULT_TENANT_SLUG } from '@atlas/core';
import { arg, flag, run } from './lib/args.ts';

const ScoreSchema = z.object({
  factual_verifiability: z.number().min(1).max(5),
  intent_coverage: z.number().min(1).max(5),
  structural_completeness: z.number().min(1).max(5),
  information_originality: z.number().min(1).max(5),
  readability: z.number().min(1).max(5),
  notes: z.string(),
});

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...markdownFiles(path));
    else if (entry.endsWith('.md') || entry.endsWith('.mdx')) out.push(path);
  }
  return out;
}

await run(async () => {
  const tenantSlug = arg('tenant') ?? DEFAULT_TENANT_SLUG;
  const dir = arg('dir') ?? `site/src/content/${tenantSlug}`;
  const write = flag('write');

  const rubric = readFileSync('brand/quality-rubric.md', 'utf8');
  const files = markdownFiles(dir);

  if (files.length === 0) {
    console.log(`no content files under ${dir}`);
    return;
  }

  const tenant = write ? await getTenantBySlug(tenantSlug) : null;
  if (write && !tenant) throw new Error(`tenant "${tenantSlug}" not found`);

  for (const file of files) {
    const shown = relative(process.cwd(), file);
    const article = readFileSync(file, 'utf8');

    const result = await callLlmStructured(
      {
        taskKind: 'content-quality-scoring',
        system:
          'You are the Atlas OS content evaluator. Score strictly against the rubric, ' +
          'using its calibration examples as anchors. An unanchored evaluator drifts ' +
          'toward 4s — resist that. Score what is on the page, not its potential.',
        prompt: `# Rubric\n${rubric}\n\n# Article (${shown})\n${article}`,
      },
      ScoreSchema,
    );

    const composite =
      (result.factual_verifiability +
        result.intent_coverage +
        result.structural_completeness +
        result.information_originality +
        result.readability) /
      5;

    console.log(`${composite.toFixed(2)}  ${shown}`);
    console.log(
      `        verifiability ${result.factual_verifiability}, intent ${result.intent_coverage}, ` +
        `structure ${result.structural_completeness}, originality ${result.information_originality}, ` +
        `readability ${result.readability}`,
    );
    console.log(`        ${result.notes}`);

    if (write && tenant) {
      // Path convention matches the site's flat URLs (see content/config.ts).
      const slug = shown.split('/').pop()!.replace(/\.mdx?$/, '');
      const page = await getPageByPath(tenant.id, `/${slug}`);
      if (page) {
        await setQualityScore(page.id, composite);
        console.log(`        stored on page ${page.id}`);
      } else {
        console.log(`        no pages row for /${slug} — not stored`);
      }
    }
  }
});
