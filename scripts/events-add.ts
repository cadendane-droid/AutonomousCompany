// TIER B: logic complete, untested against a live Postgres.
//
// Manual entry for external_events — the confounder record every future
// measurement depends on (plan §4.1). "Was there a confounder in this window"
// is unanswerable retroactively, so this is deliberately the shortest script
// in the repo to run: two required arguments and you are done.
//
//   pnpm events:add --kind algo_update --description "March core update"
//
// Semi-manual is fine and honest. You will add rows by hand. That is expected.
import { getTenantBySlug, query } from '@atlas/db';
import { DEFAULT_TENANT_SLUG, ExternalEventKindSchema } from '@atlas/core';
import { arg, flag, requireArg, run } from './lib/args.ts';

const USAGE = `usage: pnpm events:add --kind <kind> --description "<what happened>" \\
  [--date YYYY-MM-DD] [--severity low|medium|high] [--source <url>] \\
  [--platform]   # platform-wide rather than tenant-scoped

kinds: ${ExternalEventKindSchema.options.join(' | ')}`;

await run(async () => {
  const kind = ExternalEventKindSchema.parse(requireArg('kind', USAGE));
  const description = requireArg('description', USAGE);
  const date = arg('date') ?? new Date().toISOString().slice(0, 10);
  const severity = arg('severity') ?? null;
  const source = arg('source') ?? null;

  // A platform-wide event (an algorithm update) is not tenant-scoped.
  let tenantId: string | null = null;
  if (!flag('platform')) {
    const slug = arg('tenant') ?? DEFAULT_TENANT_SLUG;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) throw new Error(`tenant "${slug}" not found — run pnpm db:seed first`);
    tenantId = tenant.id;
  }

  const rows = await query<{ id: string }>(
    `insert into external_events (tenant_id, date, kind, description, severity, source)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [tenantId, date, kind, description, severity, source],
  );

  console.log(
    `recorded ${kind} on ${date} as ${rows[0]?.id} ` +
      `(${tenantId ? 'tenant-scoped' : 'platform-wide'})`,
  );
});
