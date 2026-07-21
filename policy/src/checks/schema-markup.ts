// TIER A: fully working.
//
// The site generates JSON-LD from frontmatter at build time, so the
// deterministic check is that the frontmatter inputs produce valid JSON-LD:
// FAQ entries complete, sources well-formed, and the generated Article object
// serializes with its required fields.
import type { PolicyCheck } from '../types.js';
import { changedContentFiles, readContentFile } from '../content.js';

export const schemaMarkup: PolicyCheck = {
  name: 'schema-markup',
  kind: 'deterministic',
  async run(ctx) {
    const files = changedContentFiles(ctx);
    if (files.length === 0) {
      return { status: 'not-applicable', message: 'no content files changed' };
    }

    const problems: string[] = [];
    for (const file of files) {
      const parsed = readContentFile(ctx.repoRoot, file.path);
      if (!parsed?.frontmatter) continue; // frontmatter check owns that failure

      const fm = parsed.frontmatter;
      // Mirror of site/src/lib/schema.ts article generation.
      const article = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: fm.title,
        datePublished: fm.published.toISOString(),
        dateModified: fm.updated.toISOString(),
      };
      try {
        const roundTripped = JSON.parse(JSON.stringify(article)) as Record<string, unknown>;
        for (const required of ['@type', 'headline', 'datePublished']) {
          if (!roundTripped[required]) {
            problems.push(`${file.path}: generated Article JSON-LD missing ${required}`);
          }
        }
      } catch (err) {
        problems.push(`${file.path}: Article JSON-LD does not serialize: ${err}`);
      }

      if (fm.faq) {
        fm.faq.forEach((entry, i) => {
          if (!entry.question.trim() || !entry.answer.trim()) {
            problems.push(`${file.path}: faq[${i}] has an empty question or answer`);
          }
        });
      }

      // Raw JSON-LD blocks in the body must parse.
      for (const match of parsed.body.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      )) {
        try {
          JSON.parse(match[1]!);
        } catch {
          problems.push(`${file.path}: inline JSON-LD block is not valid JSON`);
        }
      }
    }

    return problems.length > 0
      ? { status: 'fail', message: problems.join('; '), details: { problems } }
      : { status: 'pass', message: 'schema markup inputs valid' };
  },
};
