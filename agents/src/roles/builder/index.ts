// TIER B: logic complete, untested against live API (needs ANTHROPIC_API_KEY,
// GITHUB_TOKEN, Postgres).
//
// Builder role (plan §6.3): content creation via the six-step pipeline with a
// SEPARATE, NON-OPTIONAL fact-check pass. Output is always a pull request.
import { z } from 'zod';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callLlm, callLlmStructured } from '@atlas/llm';
import { PageTypeSchema } from '@atlas/core';
import { assembleContext } from '../../context.js';
import { loadPrompt } from '../../prompts.js';
import { openProposal } from '../../proposals/index.js';
import type { JobContext, RoleHandlers } from '../types.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const DraftJobPayloadSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  type: PageTypeSchema,
  cluster: z.string().min(1),
  target_query: z.string().min(1),
  /**
   * Research inputs. The worker has no web access at this stage; sources are
   * gathered by Scout jobs or humans and passed in. A draft with no sources
   * is refused — fabricating specs is the gravest failure (prompt).
   */
  sources: z.array(z.object({ title: z.string(), url: z.string().url(), notes: z.string().optional() })).min(1),
});

const OutlineSchema = z.object({
  sections: z.array(z.object({ heading: z.string(), intent: z.string() })).min(3),
});

const FactCheckSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string(),
      source_url: z.string().nullable(),
      verdict: z.enum(['supported', 'unsupported']),
    }),
  ),
});

const SelfReviewSchema = z.object({
  composite_score: z.number().min(1).max(5),
  weakest_dimension: z.string(),
  revision_needed: z.boolean(),
});

async function draftArticle(ctx: JobContext): Promise<string> {
  const payload = DraftJobPayloadSchema.parse(ctx.job.payload);
  const system = loadPrompt('builder');
  const context = await assembleContext({
    tenant: ctx.tenant,
    role: 'builder',
    taskSummary: `Draft article: ${payload.title}`,
  });
  const sourcesBlock = payload.sources
    .map((s) => `- ${s.title}: ${s.url}${s.notes ? ` (${s.notes})` : ''}`)
    .join('\n');

  // Step 1 (research) is upstream: sources arrive in the payload, recorded.
  // Step 2 — outline against query intent.
  const outline = await callLlmStructured(
    {
      taskKind: 'article-outline',
      system,
      prompt:
        `${context.text}\n\nOutline a ${payload.type} titled "${payload.title}" for the ` +
        `query "${payload.target_query}". Sources available:\n${sourcesBlock}\n\n` +
        `Emit JSON: {"sections": [{"heading": string, "intent": string}, ...]}`,
      jobId: ctx.job.id,
      tenantId: ctx.tenant.id,
      role: 'builder',
    },
    OutlineSchema,
  );

  // Step 3 — draft.
  const draft = await callLlm({
    taskKind: 'article-drafting',
    system,
    prompt:
      `${context.text}\n\nWrite the article body (Markdown, no frontmatter) for ` +
      `"${payload.title}" following this outline:\n` +
      outline.sections.map((s) => `## ${s.heading} — ${s.intent}`).join('\n') +
      `\n\nUse ONLY these sources for factual claims:\n${sourcesBlock}\n\n` +
      `End with a "## Sources" section listing every source used. Every factual ` +
      `claim must be traceable to one of the sources; omit anything you cannot source.`,
    jobId: ctx.job.id,
    tenantId: ctx.tenant.id,
    role: 'builder',
  });

  // Step 4 — self-review against the rubric.
  const review = await callLlmStructured(
    {
      taskKind: 'content-quality-scoring',
      system,
      prompt:
        `Score this draft 1–5 against the Atlas quality rubric (factual verifiability, ` +
        `intent coverage, structural completeness, originality, readability). ` +
        `Emit JSON {"composite_score": number, "weakest_dimension": string, "revision_needed": boolean}.` +
        `\n\n${draft.text}`,
      jobId: ctx.job.id,
      tenantId: ctx.tenant.id,
      role: 'builder',
    },
    SelfReviewSchema,
  );
  if (review.composite_score < 3.5) {
    throw new Error(
      `draft self-review scored ${review.composite_score} (< 3.5); weakest: ${review.weakest_dimension}. ` +
        `Not emitting a PR that policy will reject.`,
    );
  }

  // Step 5 — the fact-check pass. Separate and non-negotiable (plan §6.3).
  const factCheck = await callLlmStructured(
    {
      taskKind: 'fact-check',
      system,
      prompt:
        `List every factual claim in this article (specs, numbers, comparative claims) ` +
        `and map each to one of the allowed source URLs, or mark it unsupported. ` +
        `Emit JSON {"claims": [{"claim": string, "source_url": string|null, "verdict": "supported"|"unsupported"}]}.\n\n` +
        `Allowed sources:\n${sourcesBlock}\n\nArticle:\n${draft.text}`,
      jobId: ctx.job.id,
      tenantId: ctx.tenant.id,
      role: 'builder',
    },
    FactCheckSchema,
  );
  const unsupported = factCheck.claims.filter((c) => c.verdict === 'unsupported');
  if (unsupported.length > 0) {
    throw new Error(
      `fact-check found ${unsupported.length} unsupported claim(s): ` +
        unsupported.map((c) => c.claim).slice(0, 5).join(' | ') +
        ' — draft rejected, not revised silently. Re-run with better sources or a narrower scope.',
    );
  }

  // Step 6 — emit the PR.
  const today = new Date().toISOString().slice(0, 10);
  const typeDir = payload.type === 'buying-guide' ? 'guides' : `${payload.type}s`;
  const filePath = `site/src/content/${ctx.tenant.slug}/${typeDir}/${payload.slug}.md`;
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(payload.title)}`,
    `slug: ${JSON.stringify(payload.slug)}`,
    `type: ${JSON.stringify(payload.type)}`,
    `cluster: ${JSON.stringify(payload.cluster)}`,
    `published: ${today}`,
    `updated: ${today}`,
    'monetized: false',
    'atlas:',
    `  tenant: ${JSON.stringify(ctx.tenant.slug)}`,
    `  quality_score: ${review.composite_score}`,
    '  cohort: null',
    '  protected: false',
    '  last_decision_id: null',
    '---',
    '',
  ].join('\n');

  const result = await openProposal({
    tenantId: ctx.tenant.id,
    role: 'builder',
    kind: 'content',
    branchName: `builder/${payload.slug}-${Date.now()}`,
    title: `content: add ${payload.type} "${payload.title}"`,
    proposal: {
      proposal: `Add ${payload.type} "${payload.title}" (${payload.slug}) to cluster ${payload.cluster}.`,
      rationale: `Targets query "${payload.target_query}". Self-review composite ${review.composite_score}. ${factCheck.claims.length} factual claims, all source-mapped.`,
      expected_direction: 'Indexation and impressions growth for the target cluster.',
      measurable: false,
      measurable_note: 'New page at current traffic; logged as Tier 1 decision.',
      guardrails: ['crawl errors', 'cluster-level impressions'],
      rollback: { method: 'Revert the merge commit', condition: 'Page flagged by quality audit or manual review within 30d' },
      risk: 'low',
    },
    files: [{ path: filePath, content: frontmatter + draft.text }],
    repoRoot: REPO_ROOT,
  });

  return `PR opened: ${result.prUrl} (decision ${result.decisionId})`;
}

export const builderHandlers: RoleHandlers = {
  'draft-article': draftArticle,
};
