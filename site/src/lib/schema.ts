// TIER A: pure JSON-LD generation from frontmatter (plan §3.2).
//
// Kept as plain functions rather than inline template logic so the Policy
// Engine's schema-markup check and the site emit structurally identical
// JSON-LD, and so this is unit testable without rendering a page.
import type { Frontmatter } from '@atlas/core';

/**
 * Frontmatter as the content collection exposes it: identical to the canonical
 * schema minus `slug`, which Astro consumes for slug generation and therefore
 * strips from `entry.data`. See src/content/config.ts for why.
 */
export type EntryFrontmatter = Omit<Frontmatter, 'slug'>;

export interface SchemaContext {
  /** Absolute site origin, no trailing slash. */
  site: string;
  /** Absolute canonical URL for the page. */
  canonical: string;
  /** Publisher / brand name. */
  publisher: string;
}

type JsonLd = Record<string, unknown>;

/** Article schema. Applies to every content page. */
export function articleSchema(fm: EntryFrontmatter, ctx: SchemaContext): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: fm.description ?? undefined,
    datePublished: toIsoDate(fm.published),
    dateModified: toIsoDate(fm.updated),
    mainEntityOfPage: { '@type': 'WebPage', '@id': ctx.canonical },
    publisher: { '@type': 'Organization', name: ctx.publisher },
    // Deliberately no `author` with a fabricated person. The site discloses AI
    // involvement (spec §13); inventing a human byline would contradict that.
    author: { '@type': 'Organization', name: ctx.publisher },
    isAccessibleForFree: true,
  };
}

/**
 * FAQPage schema, emitted only when the frontmatter carries FAQ entries.
 * Google penalizes FAQ markup that does not match visible page content, so
 * this and the rendered FAQ section come from the same frontmatter array.
 */
export function faqSchema(fm: EntryFrontmatter): JsonLd | null {
  if (!fm.faq || fm.faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: fm.faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

export interface ProductRef {
  name: string;
  /** Absolute URL to the product or its review section. */
  url?: string;
  /** Editorial rating 1–5, only where a real assessment exists. */
  rating?: number;
  brand?: string;
}

/**
 * Product / ItemList schema for review and comparison pages.
 *
 * Deliberately emits no `offers` block: price and availability change
 * constantly and stale price markup is both a trust failure and a
 * rich-result penalty. Prices belong in the affiliate merchant's page.
 */
export function productListSchema(products: ProductRef[], ctx: SchemaContext): JsonLd | null {
  if (products.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        url: product.url ?? ctx.canonical,
        ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
        ...(product.rating
          ? {
              review: {
                '@type': 'Review',
                reviewRating: {
                  '@type': 'Rating',
                  ratingValue: product.rating,
                  bestRating: 5,
                  worstRating: 1,
                },
                author: { '@type': 'Organization', name: ctx.publisher },
              },
            }
          : {}),
      },
    })),
  };
}

/** Every JSON-LD block for a page, with nulls dropped. */
export function pageSchemas(
  fm: EntryFrontmatter,
  ctx: SchemaContext,
  products: ProductRef[] = [],
): JsonLd[] {
  return [articleSchema(fm, ctx), faqSchema(fm), productListSchema(products, ctx)].filter(
    (schema): schema is JsonLd => schema !== null,
  );
}

function toIsoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
