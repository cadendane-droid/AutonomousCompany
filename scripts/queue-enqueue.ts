// TIER B: logic complete, untested against a live Postgres.
//
// Put a job on the queue. Usage:
//   pnpm queue:enqueue --role operator --kind health-check
//   pnpm queue:enqueue --role builder --kind draft-article --payload '{"slug":"x"}'
import { enqueue, getTenantBySlug } from '@atlas/db';
import { DEFAULT_TENANT_SLUG, RoleNameSchema } from '@atlas/core';
import { arg, requireArg, run } from './lib/args.ts';

const USAGE =
  'usage: pnpm queue:enqueue --role <role> --kind <kind> [--tenant <slug>] ' +
  "[--payload '<json>'] [--priority <n>]";

await run(async () => {
  const role = RoleNameSchema.parse(requireArg('role', USAGE));
  const kind = requireArg('kind', USAGE);
  const tenantSlug = arg('tenant') ?? DEFAULT_TENANT_SLUG;
  const priority = arg('priority') ? Number(arg('priority')) : undefined;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error(`tenant "${tenantSlug}" not found — run pnpm db:seed first`);

  let payload: unknown = null;
  const raw = arg('payload');
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`--payload is not valid JSON: ${raw}`);
    }
  }

  const job = await enqueue({
    tenantId: tenant.id,
    role,
    kind,
    payload,
    ...(priority === undefined ? {} : { priority }),
  });

  console.log(`enqueued ${role}/${kind} as ${job.id} (priority ${job.priority})`);
});
