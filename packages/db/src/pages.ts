// TIER B: logic complete, untested against live API (needs a running Postgres).
import { z } from 'zod';
import { PageSchema, type Page, type PageType } from '@atlas/core';
import { query } from './client.js';

export async function getPageByPath(tenantId: string, path: string): Promise<Page | null> {
  const rows = await query('select * from pages where tenant_id = $1 and path = $2', [
    tenantId,
    path,
  ]);
  return rows[0] ? PageSchema.parse(rows[0]) : null;
}

export async function listPages(tenantId: string, type?: PageType): Promise<Page[]> {
  const rows = type
    ? await query('select * from pages where tenant_id = $1 and type = $2 order by path', [
        tenantId,
        type,
      ])
    : await query('select * from pages where tenant_id = $1 order by path', [tenantId]);
  return z.array(PageSchema).parse(rows);
}

/** Idempotent sync from content frontmatter → pages row. */
export async function upsertPage(input: {
  tenantId: string;
  slug: string;
  path: string;
  type: PageType;
  cluster: string | null;
  protected: boolean;
  publishedAt: Date | null;
  updatedAt: Date | null;
}): Promise<Page> {
  const rows = await query(
    `insert into pages (tenant_id, slug, path, type, cluster, protected, published_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (tenant_id, path) do update
       set slug = excluded.slug, type = excluded.type, cluster = excluded.cluster,
           protected = excluded.protected, updated_at = excluded.updated_at
     returning *`,
    [
      input.tenantId,
      input.slug,
      input.path,
      input.type,
      input.cluster,
      input.protected,
      input.publishedAt,
      input.updatedAt,
    ],
  );
  return PageSchema.parse(rows[0]);
}

export async function setQualityScore(pageId: string, score: number): Promise<void> {
  await query('update pages set quality_score = $2 where id = $1', [pageId, score]);
}
