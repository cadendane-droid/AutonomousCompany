// TIER B: logic complete, untested against live API (needs a running Postgres).
import { z } from 'zod';
import { TenantSchema, type Rung, type Tenant } from '@atlas/core';
import { query } from './client.js';

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const rows = await query('select * from tenants where slug = $1', [slug]);
  return rows[0] ? TenantSchema.parse(rows[0]) : null;
}

export async function listTenants(): Promise<Tenant[]> {
  return z.array(TenantSchema).parse(await query('select * from tenants order by created_at'));
}

export async function createTenant(input: {
  slug: string;
  domain: string;
  niche?: string | null;
}): Promise<Tenant> {
  const rows = await query(
    `insert into tenants (slug, domain, niche) values ($1, $2, $3) returning *`,
    [input.slug, input.domain, input.niche ?? null],
  );
  return TenantSchema.parse(rows[0]);
}

/** Rung changes are deliberate human acts (gates in plan §9–10). */
export async function setTenantRung(tenantId: string, rung: Rung): Promise<void> {
  await query('update tenants set rung = $2 where id = $1', [tenantId, rung]);
}
