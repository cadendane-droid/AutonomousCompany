// TIER A: pure Zod schema for content frontmatter (plan §3.1).
import { z } from 'zod';
import { PageTypeSchema } from './enums.js';

/**
 * Content frontmatter — exactly implementation plan §3.1, including the
 * nested `atlas` block. Present from the first article even though nothing
 * reads parts of it yet; backfilling later is error-prone.
 *
 * Consumed by: site content collections, policy frontmatter check,
 * builder agent output validation.
 */
export const AtlasBlockSchema = z.object({
  tenant: z.string().min(1),
  quality_score: z.number().min(1).max(5).nullable(),
  /** Assigned when split-URL testing begins (Rung 1). Null until then. */
  cohort: z.string().uuid().nullable(),
  protected: z.boolean(),
  last_decision_id: z.string().uuid().nullable(),
});

export const FrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  /** Drives cohort stratification later. */
  type: PageTypeSchema,
  /** Topical grouping, e.g. "tents". */
  cluster: z.string().min(1),
  published: z.coerce.date(),
  updated: z.coerce.date(),
  description: z.string().optional(),
  /** True when the page carries affiliate links → disclosure required. */
  monetized: z.boolean().default(false),
  /** FAQ entries rendered and emitted as FAQPage JSON-LD. */
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })).optional(),
  atlas: AtlasBlockSchema,
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;
export type AtlasBlock = z.infer<typeof AtlasBlockSchema>;