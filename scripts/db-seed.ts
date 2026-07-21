// TIER B: logic complete, untested against a live Postgres.
//
// Seeds the minimum a fresh database needs to be usable: one tenant and its
// system_state row. Idempotent — safe to re-run.
//
// Usage: pnpm db:seed [--slug tenant-alpha] [--domain example-tenant.com]
import { createTenant, getSystemState, getTenantBySlug, query } from '@atlas/db';
import { DEFAULT_TENANT_DOMAIN, DEFAULT_TENANT_SLUG, PLACEHOLDER_NICHE } from '@atlas/core';
import { arg, run } from './lib/args.ts';

const USAGE = 'usage: pnpm db:seed [--slug <slug>] [--domain <domain>] [--niche <niche>]';

await run(async () => {
  const slug = arg('slug') ?? DEFAULT_TENANT_SLUG;
  const domain = arg('domain') ?? DEFAULT_TENANT_DOMAIN;
  const niche = arg('niche') ?? PLACEHOLDER_NICHE;

  if (arg('help') !== undefined) {
    console.log(USAGE);
    return;
  }

  let tenant = await getTenantBySlug(slug);
  if (tenant) {
    console.log(`tenant "${slug}" already exists (${tenant.id}) — leaving it alone`);
  } else {
    // Rung 0 is the only honest starting position: no traffic, no experiments.
    // The column defaults to 0; promotion is a deliberate human act.
    tenant = await createTenant({ slug, domain, niche });
    console.log(`created tenant "${slug}" (${tenant.id}) at rung ${tenant.rung}`);
  }

  const state = await getSystemState(tenant.id);
  if (state) {
    console.log(`system_state exists (frozen: ${state.frozen})`);
  } else {
    await query(
      `insert into system_state (tenant_id, frozen, freeze_reason, set_by)
       values ($1, false, null, 'db:seed')
       on conflict (tenant_id) do nothing`,
      [tenant.id],
    );
    console.log('created system_state, not frozen');
  }

  console.log(
    `\nSeeded. TODO(setup): replace the placeholder slug, domain, and niche ` +
      `once Stage 0 decisions are made — see OPEN-QUESTIONS.md §1.`,
  );
});
