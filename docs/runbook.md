# Runbook

Operating procedures. Written to be followed under pressure, so each one is a
sequence of commands rather than an explanation.

## Run a migration

Migrations are numbered, idempotent, and forward-only. The runner tracks applied
migrations in `schema_migrations` and does not depend on the Supabase CLI.

```bash
pnpm db:migrate              # apply everything pending
```

To add one: create `db/migrations/00NN_name.sql`, write idempotent DDL
(`create table if not exists`, `create index if not exists`), and include a
comment documenting the manual reversal. There is no `down` migration by design
— forward-only avoids a class of half-reverted schema states, and the reversal
comment is there for the case where you genuinely need it.

Verify before and after:

```bash
psql "$DATABASE_URL" -c "select * from schema_migrations order by applied_at"
```

## Freeze and unfreeze the system

Freezing halts non-Operator agent work and blocks merges. It is cheap; unfreezing
is deliberately not.

**Freeze:**

```bash
psql "$DATABASE_URL" -c "
  update system_state
     set frozen = true,
         freeze_reason = 'REASON HERE',
         frozen_at = now(),
         set_by = 'human:YOUR-NAME'
   where tenant_id = (select id from tenants where slug = 'tenant-alpha')"
```

The Operator health check also freezes automatically on a severe finding.

**Unfreeze — only after the cause is understood:**

```bash
psql "$DATABASE_URL" -c "
  update system_state
     set frozen = false, freeze_reason = null, set_by = 'human:YOUR-NAME'
   where tenant_id = (select id from tenants where slug = 'tenant-alpha')"
```

Per spec §12, resume only after two clean measurement periods. There is no CLI
for unfreezing on purpose: it should require looking up the SQL, which is a
small amount of friction in the right place.

## Roll back a deploy

Two things are separate and both usually needed: the deployed site, and the
commit that caused it.

**Site, immediately** — Vercel dashboard → Deployments → the last good one →
Promote to Production. Seconds, no build.

**Then the commit**, so the next deploy does not reintroduce it:

```bash
git revert <sha> && git push
```

`decisions.rollback_ref` holds the reference recorded before the change shipped;
that is what you are reverting to. Log the rollback:

```bash
pnpm decisions:log \
  --summary "Rolled back <what>" \
  --rationale "<what breached, with numbers>" \
  --measurable no \
  --rollback "reverted <sha>" \
  --kind infrastructure
```

Note the timing asymmetry (plan §5.5): conversion and technical regressions can
be rolled back within hours. **Ranking effects take weeks — do not roll back a
content change on two weeks of ranking noise.** That thrashes and teaches you
nothing.

## Add a tenant

```bash
pnpm tenant:create --slug my-site --domain my-site.com --niche "..."
```

The script prints the remaining manual steps and deliberately does not do them:
content directories, the collection in `site/src/content/config.ts`, brand rules,
Search Console verification, affiliate credentials. Each is a reviewable commit.

## When a connector fails

A connector that silently stops is worse than one that never existed, because
the gap gets read as a real decline. **A zero is a value; a missing row is not.**

1. Find out which, and when it last worked:

   ```bash
   psql "$DATABASE_URL" -c "
     select connector, status, rows_written, started_at, error
       from ingest_runs order by started_at desc limit 20"
   ```

2. Re-run just that connector:

   ```bash
   pnpm ingest:run --connector search-console
   ```

3. Backfill the gap. Most connectors accept an explicit range:

   ```bash
   pnpm ingest:run --connector search-console --from 2026-07-01 --to 2026-07-14
   ```

   Search Console retains 16 months. Beyond that the data is gone permanently —
   backfill early rather than carefully.

4. Record it as an external event if the gap will confound later measurement:

   ```bash
   pnpm events:add --kind other --description "GSC ingest gap 2026-07-01..14"
   ```

   This is the step people skip and then need. Nothing else can answer "was
   there a confounder in this window" retroactively.

## Review an agent pull request

The Policy Engine has already checked what is mechanically checkable. Your job
is the part it cannot do.

1. **Read the proposal body first, not the diff.** Does the rationale actually
   support the change? Is `Measurable: No` honest — at Rung 0 it almost always
   should be, and a `Yes` deserves scrutiny about what would measure it.
2. **Check the fact-check.** For content, every factual claim should map to a
   source in the Sources section. Spot-check two or three against the actual
   source. Do this forever; it is the most likely way this system destroys its
   own credibility.
3. **Check the rollback condition** is specific enough to evaluate. "Monitor
   performance" is not a rollback condition. "LCP regression > 200ms over 7d" is.
4. **Read the diff.** Confirm the change matches the proposal's stated scope.
5. **Approve through GitHub review.** That approval is what `human_approved`
   reads. Approving an earlier commit does not approve later pushes — a new push
   requires a new approval.

If the Policy Engine failed, do not merge and do not adjust `policy/rules.yml`
to make it pass. Threshold changes are their own reviewed commit, made
deliberately, not as a way past a specific blocked PR. That is the failure the
whole specification exists to prevent, and it will feel completely reasonable in
the moment.

## Drain the job queue manually

```bash
pnpm --filter @atlas/agents worker                    # all roles
pnpm --filter @atlas/agents worker --role operator    # one role
```

Or trigger the `Agent worker` workflow via manual dispatch.

Inspect the queue:

```bash
psql "$DATABASE_URL" -c "
  select role, kind, status, attempts, last_error, created_at
    from jobs where status <> 'done' order by created_at desc limit 20"
```

Jobs marked `dead` have exhausted `max_attempts` and stay visible for triage
rather than being deleted. Stale `running` jobs are returned to the queue by
`reapStale`, which the worker calls on every drain.

## Check spend against budget

```bash
psql "$DATABASE_URL" -c "select * from v_llm_spend_month"
```

The router degrades to cheaper tiers as the cap approaches and hard-stops at it.
If the queue has stalled and jobs are erroring on budget, that is the hard stop
working, not a bug. Raise `ATLAS_LLM_MONTHLY_BUDGET_USD` deliberately or wait
for the month to roll.
