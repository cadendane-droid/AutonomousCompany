# Architecture

How this repository maps onto the specifications, and where the constraints are
actually enforced. Read [`atlas-os-master-spec-v2.md`](atlas-os-master-spec-v2.md)
for what the system is and [`atlas-os-implementation-plan.md`](atlas-os-implementation-plan.md)
for the staged plan. This document covers only the mapping.

## The shape of it

```
                    Markdown content in Git
                              │
   ingest/  ──────────▶  Postgres (Supabase + pgvector)  ◀────── agents/
   Search Console            │  metrics, jobs, decisions,          │
   PostHog                   │  knowledge, system_state            │
   affiliate                 │                                     │
   technical                 │                              context.py assembly
   external events           │                              (semantic recall)
                             │                                     │
                             ▼                                     ▼
                      packages/stats                          proposal
                 power, DiD, anomaly, health                        │
                             │                                      ▼
                             └────────────▶  POLICY ENGINE (CI)  ◀──┘
                                                    │
                                            preview → human → merge
                                                    │
                                                 Vercel
```

The load-bearing property: **nothing reaches production without passing through
a pull request that the Policy Engine evaluates.** Agents do not deploy. Agents
do not write to content. Agents open pull requests.

## Repository map

| Path | What it is | Tier |
|---|---|---|
| `packages/core` | Every shared type and Zod schema. The rung ladder as data. | A |
| `packages/db` | Typed client, migration runner, per-domain queries, the `SKIP LOCKED` queue. | B |
| `packages/stats` | Power, difference-in-differences, anomaly detection, health score, cohort assignment. Pure and unit tested. | A |
| `packages/llm` | Tiered router, Anthropic client, cost logging, budget cap with degradation. | A logic / B client |
| `policy/` | The Policy Engine: 12 checks, proposal parser, fail-closed runner, CLI. | A (model checks B) |
| `ingest/` | Five connectors plus a runner with retry and staleness assertions. | B |
| `agents/` | Worker loop, context assembly, five role handlers, proposal construction. | A loop / B–C roles |
| `site/` | Astro static site, content collections, schema markup. | A |
| `db/migrations` | Numbered, idempotent, forward-only SQL. | — |
| `scripts/` | Operational CLIs. | A–B |

Tier A means fully working with no external dependencies. Tier B means the logic
is complete but has not been verified against a live service. Tier C means an
interface only, throwing `NotImplementedError` with a note on what unblocks it.
Every module states its tier in its first comment — `grep -rn "TIER"` lists them.

## Where the important constraints are enforced

The recurring theme: constraints live in one place, as data or as a database
constraint, not as logic scattered across files.

**The maturity ladder** is `RUNG_DEFINITIONS` in
`packages/core/src/rungs.ts` — a table keyed by rung giving the session
threshold, permitted experiment methods, concurrency cap, promotable knowledge
tiers, and rollout steps. The Policy Engine reads it. Changing what a rung
permits is an edit to that table, and nothing else.

**Law 2 (reversibility)** is `decisions.rollback_ref NOT NULL` in migration
0007. Not a validation, not a convention — the database rejects the insert.

**Law 9 (no manufactured confidence)** is enforced in three places:
`decisions.measurable` is `NOT NULL` with no default, so an agent must state an
honest boolean rather than inherit a flattering one; the power check rejects any
experiment proposal whose stated MDE is unreachable at available traffic; and
confidence figures are structurally confined to Tier 3 knowledge records.

**Freeze** is the `system_state` table. The Policy Engine reads it, the worker
reads it before dispatching, the Operator health check can set it, and only a
human clears it (`policy/rules.yml`: `manual_override: human_only`).

**Blast radius** is `policy/rules.yml` `blast_radius`, evaluated against the
parsed diff. Law 8 in mechanical form.

**The five roles** are `RoleNameSchema` in `packages/core/src/enums.ts` and the
`ROLE_HANDLERS` table in `agents/src/roles/index.ts`. Five, per spec §9 — the
v1.0 seventeen-agent hierarchy is not built and the type system will not admit
a sixth role without an edit to core.

## Why Git is the source of truth

See [ADR 0002](adr/0002-git-as-source-of-truth.md). Briefly: it makes Law 2 a
property of the storage layer, gives diffs to review, and provides the CI hook
the Policy Engine sits in.

## Why there is no Redis

See [ADR 0003](adr/0003-postgres-queue-over-redis.md). The workload is dozens of
jobs per day. `FOR UPDATE SKIP LOCKED` is a complete queue at that volume, in
the same transaction scope as the writes the jobs perform.

## Why the Policy Engine is CI

See [ADR 0004](adr/0004-policy-engine-as-ci-check.md). Anything the agent can
call, the agent can decline to call. A required status check is not negotiable
by the thing being checked — **provided branch protection is configured**, which
is the one manual step that makes the rest of it real.

## What is deliberately not here

- **Experiment execution.** Tables exist (migration 0010); nothing runs them.
  Rung 1–2 work, gated on traffic rather than on effort.
- **A dashboard.** Postgres views in migration 0013, and nothing else. No React
  app.
- **The 17-agent hierarchy.** Five roles.
- **Any override mechanism in the Policy Engine.** By design, permanently.

## Data flow, concretely

1. `ingest/` connectors write daily metrics and an `ingest_runs` row with counts.
2. The Operator health check reads those, and raises jobs or freezes on failure.
3. Jobs land in the `jobs` table; the worker claims them with `SKIP LOCKED`.
4. `agents/src/context.ts` assembles role context — relevant metrics, recent
   decisions, semantically similar past decisions via pgvector, brand rules, and
   the current rung's constraints. This module determines output quality more
   than any prompt does.
5. A role handler produces a proposal and opens a pull request, linked to a
   `decisions` row.
6. The Policy Engine evaluates it and blocks or passes.
7. A human reviews and merges. Vercel deploys.
8. The change becomes a Tier 1 decision record, retrievable by step 4 next time.

Step 8 feeding step 4 is what makes Law 6 operational rather than aspirational.
