# Seed data

Seeding is a script, not a SQL file: `pnpm db:seed` (source:
[`scripts/db-seed.ts`](../../scripts/db-seed.ts)).

It creates one tenant and its `system_state` row, and it is idempotent — re-running
it leaves existing rows alone rather than resetting them. That matters because
`db:seed` is the kind of command someone runs on the wrong database eventually,
and a seed that truncates would take the decision log with it.

```bash
pnpm db:seed                                  # tenant-alpha / example-tenant.com
pnpm db:seed --slug my-site --domain my.com   # explicit
```

Everything else in the system is created by its own path: pages arrive by
building the site, decisions by `pnpm decisions:log`, jobs by
`pnpm queue:enqueue`, external events by `pnpm events:add`. There is deliberately
no fixture data — a database seeded with fake metrics is a database whose first
health score is a lie.
