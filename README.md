# Atlas OS

An autonomous publishing system that runs an affiliate content website as a
self-improving company. AI agents propose changes, a deterministic Policy Engine
gates them, everything is measured and recorded, and **the system's maturity is
gated on traffic volume** — it deliberately does not run experiments until it has
enough traffic to power them.

That last point is the design. The statistical machinery in most "autonomous
optimization" systems cannot function below roughly 10,000 sessions/month and
produces false confidence if run anyway. Atlas refuses to produce that
confidence: at low traffic it logs decisions with rationales and rollback
conditions, and says so.

> **Status: scaffold.** This repository is Stages 0–4 of the implementation
> plan. It builds, typechecks, and passes 126 tests. It has not been run against
> a live database, a live site, or live credentials — see
> [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md) for exactly what is unverified and what
> must be decided before it can run at all.

## Current rung: 0 — Foundation

The maturity ladder gates what the system is permitted to do:

| Rung | Sessions/month | What unlocks |
|---|---|---|
| **0 — Foundation** | 0–1,000 | Data capture, Policy Engine, technical SEO, content against a quality rubric. **Decision log, not experiments.** |
| 1 — Directional | 1k–10k | Pre/post with control cohorts, split-URL SEO testing (100+ pages), promotion to Working Belief. |
| 2 — Controlled | 10k–100k | True A/B testing, sequential testing, concurrency up to 3, promotion to Principle. |
| 3 — Compounding | 100k+ | Multivariate, cross-site validation, predictive modeling. |

At Rung 0, "was this measurable? No" is the honest and expected answer for most
changes. The ladder lives as data in `packages/core/src/rungs.ts`; the Policy
Engine reads it rather than re-deriving it.

## Architecture at a glance

```
Markdown in Git  ─┐
                  ├─▶  agent proposes  ─▶  pull request  ─▶  POLICY ENGINE (CI)
Postgres metrics ─┘                                              │
   (Supabase + pgvector)                                 blocks or passes
        ▲                                                        │
        │                                          preview → human review → merge
   ingest/ connectors                                             │
   (Search Console, PostHog,                                   Vercel
    affiliate, technical, events)
```

Four things do the work:

- **Git is the source of truth** for content, so rollback is `git revert` and
  every change is a reviewable diff ([ADR 0002](docs/adr/0002-git-as-source-of-truth.md)).
- **The Policy Engine is a CI check**, not a service, so an agent cannot decline
  to call it ([ADR 0004](docs/adr/0004-policy-engine-as-ci-check.md)).
- **The job queue is a Postgres table** with `SKIP LOCKED`. No Redis
  ([ADR 0003](docs/adr/0003-postgres-queue-over-redis.md)).
- **Every table is multi-tenant** from the first migration
  ([ADR 0005](docs/adr/0005-multi-tenant-from-day-one.md)).

Full detail: [docs/architecture.md](docs/architecture.md).

## Quickstart

```bash
pnpm install
pnpm build      # all packages + the Astro site
pnpm test       # 126 tests
pnpm lint
pnpm typecheck
```

That much works from a clean checkout with no credentials and no database.

To go further you need a Postgres URL and API keys.
[PROCUREMENT.md](PROCUREMENT.md) lists what to acquire, what it costs, and in
what order; [SETUP.md](SETUP.md) is the ordered checklist from clone to running.

Try the Policy Engine locally without any credentials:

```bash
git diff main > /tmp/pr.diff
pnpm policy:check --diff /tmp/pr.diff --proposal my-proposal.md --deterministic-only
```

Validate content frontmatter against the canonical schema:

```bash
pnpm content:validate
```

## Repo map

```
packages/core     shared types, Zod schemas, the rung ladder as data
packages/db       typed queries, migration runner, SKIP LOCKED queue
packages/stats    power, DiD, anomaly detection, health score, cohorts
packages/llm      tiered router, cost tracking, budget cap
policy/           the Policy Engine — 12 checks, CLI, GitHub Action
ingest/           five connectors + runner with staleness assertions
agents/           worker loop, context assembly, five role handlers
site/             Astro static site, content collections, schema markup
db/migrations     0001–0013, forward-only
scripts/          operational CLIs
docs/             specs, architecture, runbook, ADRs
brand/            rules, protected paths, quality rubric, disclosure
```

Every module declares its tier in its first comment: **A** fully working, **B**
logic complete but unverified against a live service, **C** interface only.

```bash
grep -rn "TIER [ABC]" --include="*.ts" .   # what is real and what is not
grep -rn "TODO(setup)" .                   # what a human must fill in
```

## Operational commands

| Command | Does |
|---|---|
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Create the tenant and its system_state row (idempotent) |
| `pnpm tenant:create` | Provision an additional tenant |
| `pnpm content:validate` | Validate all frontmatter against the canonical schema |
| `pnpm content:score` | Score content against the quality rubric |
| `pnpm decisions:log` | Record a Tier 1 decision |
| `pnpm queue:enqueue` | Put a job on the queue |
| `pnpm events:add` | Record an external event (confounder) |
| `pnpm ingest:run` | Run connectors |
| `pnpm policy:check` | Run the Policy Engine locally |

Procedures for freezing, rolling back, handling a failed connector, and
reviewing an agent PR: [docs/runbook.md](docs/runbook.md).

## The constitution, in short

Nine laws govern every agent (spec §2). Three are enforced structurally rather
than by instruction:

- **Law 2 — every change is reversible.** `decisions.rollback_ref` is `NOT NULL`.
  The database rejects a change with no rollback path.
- **Law 7 — no production change without a recorded rationale and rollback
  condition.** The proposal parser rejects a PR body missing either.
- **Law 9 — never claim more confidence than the data supports.**
  `decisions.measurable` is `NOT NULL` with no default; the power check rejects
  experiments that cannot detect their stated effect; confidence figures appear
  only on Tier 3 knowledge records.

Law 9 is the one the whole system is built around. A knowledge base full of
manufactured confidence is worse than no knowledge base, because agents act on
it with certainty it has not earned and each subsequent decision compounds the
error.
