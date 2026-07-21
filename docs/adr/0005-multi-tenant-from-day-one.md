# 5. Multi-tenant schema from the first migration

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

There is one site. There will be one site for a long time — the second tenant is
gated on the first reaching Rung 2, which is gated on 10,000 sessions/month,
which is a year or more away.

Building for a second tenant now looks like exactly the kind of speculative
generality that wastes early effort.

## Decision

Every table carries `tenant_id` from migration 0002 onward. The knowledge base
carries a `scope` column (`tenant` | `platform`) from the start. Content lives
under `site/src/content/{tenant}/`.

## Consequences

The asymmetry is the whole argument: **adding `tenant_id` now costs a column;
adding it later costs a migration of every table, every query, and every content
path, on a live system with a year of history in it.**

- Queries carry a `tenant_id` predicate they do not yet need. Mild cost.
- Content paths have a tenant segment that is always the same value today.
- `scripts/tenant-create.ts` exists and provisions a tenant, so the second one
  is a command rather than a project.

What this deliberately does **not** do is build the multi-tenant *features* —
cross-tenant validation queries, per-tenant configuration extraction, platform
knowledge promotion. Those are Stage 11 work and are not scaffolded. This ADR
covers the data model only.

The thesis behind it (spec §1): a principle confirmed on one site is a
hypothesis; confirmed on four independent sites it is knowledge. The moat is in
the multi-tenant configuration, so the data model should not be what stands in
the way of getting there.

## Alternatives considered

**Single-tenant now, migrate later.** The standard advice, and usually right.
It is wrong here specifically because the migration would land on a system whose
central asset is an accumulated history that a botched migration would corrupt,
and because the cost now is genuinely one column per table.
