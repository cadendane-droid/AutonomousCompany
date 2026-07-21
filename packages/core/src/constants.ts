// TIER A: pure constants. Single source of truth for placeholder values.
/**
 * Single-source-of-truth placeholders. Grep for TODO(setup) to find every
 * value a human must replace before launch.
 */

// TODO(setup): replace with the real tenant slug once the niche is chosen.
// Files that change when this is answered: db/seed/seed.ts, site/src/content/
// directory name, brand/rules.md references, this constant.
export const DEFAULT_TENANT_SLUG = 'tenant-alpha';

// TODO(setup): replace with the real production domain once purchased.
// Also update SITE_BASE_URL / GSC_SITE_URL in .env.
export const DEFAULT_TENANT_DOMAIN = 'example-tenant.com';

// TODO(setup): replace with the chosen niche (Stage 0 decision — the
// highest-leverage decision in the project; see implementation plan §2.1).
export const PLACEHOLDER_NICHE = 'PLACEHOLDER_NICHE';

// TODO(setup): replace with the chosen affiliate program(s). Sub-ID support
// is a hard requirement (implementation plan §2.1).
export const PLACEHOLDER_PROGRAM = 'PLACEHOLDER_PROGRAM';

/** OpenAI-ada / text-embedding dimension used by decisions.embedding. */
export const EMBEDDING_DIMENSIONS = 1536;

/** Statistical defaults (spec §4: 80% power, α = 0.05, two-sided). */
export const DEFAULT_POWER = 0.8;
export const DEFAULT_ALPHA = 0.05;