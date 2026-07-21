// TIER A: content collection schema, delegated entirely to packages/core.
//
// The frontmatter schema is NOT redefined here. It lives in @atlas/core so the
// site, the Policy Engine's frontmatter check, and the Builder agent's output
// validation all enforce exactly the same shape (plan §3.1).
import { defineCollection } from 'astro:content';
import { FrontmatterSchema } from '@atlas/core';

/**
 * One collection per tenant. Content is tenant-scoped from day one because
 * adding the scoping later means moving every file and rewriting every path.
 *
 * TODO(setup): when a second tenant is added, add its collection here and its
 * directory under src/content/. See OPEN-QUESTIONS.md §4.
 */
/**
 * `slug` is omitted here and ONLY here.
 *
 * Plan §3.1 requires a `slug` field in frontmatter, and it stays there — the
 * Policy Engine's frontmatter check and the Builder agent both require it. But
 * Astro reserves `slug` in collection schemas because it reads that field to
 * override the generated slug, and a schema declaring it is a build error.
 *
 * Omitting it from the collection schema gets both: the field remains in every
 * file and in @atlas/core, and Astro consumes it as the canonical slug. The
 * consequence is that article URLs are flat (`/how-to-choose-x`), not nested
 * under their type directory — the directory layout stays a content-authoring
 * concern rather than a URL commitment. See OPEN-QUESTIONS.md §2.
 */
const tenantAlpha = defineCollection({
  type: 'content',
  schema: FrontmatterSchema.omit({ slug: true }),
});

export const collections = {
  'tenant-alpha': tenantAlpha,
};
