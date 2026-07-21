// TIER A: JSON-LD generation. These assertions exist because invalid or
// mismatched structured data is a silent failure — the page renders fine and
// the rich result quietly never appears.
import { describe, expect, it } from 'vitest';
import type { Frontmatter } from '@atlas/core';
import { articleSchema, faqSchema, pageSchemas, productListSchema } from './schema.ts';

const ctx = {
  site: 'https://example-tenant.com',
  canonical: 'https://example-tenant.com/how-to-choose-x',
  publisher: 'PLACEHOLDER_NICHE Guide',
};

const fm: Frontmatter = {
  title: 'How to Choose X',
  slug: 'how-to-choose-x',
  type: 'buying-guide',
  cluster: 'placeholder-cluster',
  published: new Date('2026-07-21'),
  updated: new Date('2026-07-28'),
  monetized: true,
  atlas: {
    tenant: 'tenant-alpha',
    quality_score: null,
    cohort: null,
    protected: false,
    last_decision_id: null,
  },
};

describe('articleSchema', () => {
  it('emits dates as plain ISO dates, not timestamps', () => {
    const schema = articleSchema(fm, ctx);
    expect(schema.datePublished).toBe('2026-07-21');
    expect(schema.dateModified).toBe('2026-07-28');
  });

  it('attributes authorship to the organization, never a fabricated person', () => {
    const schema = articleSchema(fm, ctx) as { author: { '@type': string; name: string } };
    expect(schema.author['@type']).toBe('Organization');
    expect(schema.author.name).toBe(ctx.publisher);
  });

  it('points mainEntityOfPage at the canonical URL', () => {
    const schema = articleSchema(fm, ctx) as { mainEntityOfPage: { '@id': string } };
    expect(schema.mainEntityOfPage['@id']).toBe(ctx.canonical);
  });
});

describe('faqSchema', () => {
  it('returns null when there are no FAQ entries, rather than an empty FAQPage', () => {
    expect(faqSchema(fm)).toBeNull();
  });

  it('maps every frontmatter entry to a Question with an accepted answer', () => {
    const withFaq: Frontmatter = {
      ...fm,
      faq: [
        { question: 'Q one', answer: 'A one' },
        { question: 'Q two', answer: 'A two' },
      ],
    };
    const schema = faqSchema(withFaq) as { mainEntity: Array<Record<string, unknown>> };
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q one',
      acceptedAnswer: { '@type': 'Answer', text: 'A one' },
    });
  });
});

describe('productListSchema', () => {
  it('returns null for an empty product list', () => {
    expect(productListSchema([], ctx)).toBeNull();
  });

  it('never emits an offers block, so stale prices cannot be published', () => {
    const schema = productListSchema([{ name: 'Product A', rating: 4 }], ctx);
    expect(JSON.stringify(schema)).not.toContain('offers');
  });

  it('numbers list positions from one', () => {
    const schema = productListSchema([{ name: 'A' }, { name: 'B' }], ctx) as {
      itemListElement: Array<{ position: number }>;
    };
    expect(schema.itemListElement.map((item) => item.position)).toEqual([1, 2]);
  });

  it('omits the review block when no rating was assessed', () => {
    const schema = productListSchema([{ name: 'A' }], ctx);
    expect(JSON.stringify(schema)).not.toContain('reviewRating');
  });
});

describe('pageSchemas', () => {
  it('drops nulls so no empty schema block reaches the page', () => {
    const schemas = pageSchemas(fm, ctx);
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toMatchObject({ '@type': 'Article' });
  });

  it('includes every applicable schema together', () => {
    const withFaq: Frontmatter = { ...fm, faq: [{ question: 'Q', answer: 'A' }] };
    const schemas = pageSchemas(withFaq, ctx, [{ name: 'Product A' }]);
    expect(schemas.map((s) => s['@type'])).toEqual(['Article', 'FAQPage', 'ItemList']);
  });
});
