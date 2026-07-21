// TIER B: logic complete, untested against a live Postgres.
//
// Provision a new tenant. The multi-tenant path exists from day one so the
// second tenant is a command rather than a migration (plan §11).
//
// Usage: pnpm tenant:create --slug <slug> --domain <domain> [--niche <niche>]
import { createTenant, getTenantBySlug, query } from '@atlas/db';
import { arg, requireArg, run } from './lib/args.ts';

const USAGE =
  'usage: pnpm tenant:create --slug <slug> --domain <domain> [--niche <niche>]';

await run(async () => {
  const slug = requireArg('slug', USAGE);
  const domain = requireArg('domain', USAGE);
  const niche = arg('niche') ?? null;

  const existing = await getTenantBySlug(slug);
  if (existing) {
    throw new Error(`tenant "${slug}" already exists (${existing.id})`);
  }

  const tenant = await createTenant({ slug, domain, niche });
  await query(
    `insert into system_state (tenant_id, frozen, set_by)
     values ($1, false, 'tenant:create') on conflict (tenant_id) do nothing`,
    [tenant.id],
  );

  console.log(`created tenant "${slug}" (${tenant.id}) at rung ${tenant.rung}`);
  console.log(`
Remaining steps, which this script deliberately does NOT do for you:

  1. Create site/src/content/${slug}/{guides,reviews,comparisons}/
  2. Add the collection to site/src/content/config.ts
  3. Add ${slug} brand rules under brand/ if they differ from the default
  4. Verify the domain in Search Console and set GSC_SITE_URL for it
  5. Add the tenant's affiliate program credentials

Each of those is a reviewable commit. Generating them automatically would put
an unreviewed tenant into the content pipeline.`);
});
