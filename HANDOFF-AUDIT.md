# Handoff Audit

A previous session scaffolded this repo and stopped mid-build when it ran out of
credits. This file recorded the state it was found in and now records what
remains.

**Original audit:** 2026-07-21 at commit `af19fea`.
**Updated:** 2026-07-21, after completing the scaffold.

**This file is still here because the scaffold is not 100% done by its own
done-conditions.** Two of them require a live Postgres and a deployed site,
neither of which existed in this environment. Everything else is complete. See
"What remains" at the bottom — when those two are ticked, delete this file.

## State it was found in

The repo compiled as found — no file was truncated mid-write, and the
interruption landed cleanly between build items rather than inside one. What was
missing was missing entirely: `site/`, `scripts/`, `.github/`, all top-level
documentation, and the worker plus four of the five agent roles.

| Command | As found | Now |
|---|---|---|
| `pnpm install` | passes | passes |
| `pnpm build` | passes | passes |
| `pnpm typecheck` | passes | passes |
| `pnpm test` | passes — 92 tests | passes — **126 tests** |
| `pnpm lint` | **fails** — 1 error | passes |

## Build items — final status

| # | Item | As found | Now | What changed |
|---|---|---|---|---|
| 1 | Repo foundation | PARTIAL | **COMPLETE** | Fixed the lint failure; added a root `tsconfig.json` so `scripts/` is typechecked; added the root runtime deps the scripts needed. |
| 2 | `packages/core` | COMPLETE | COMPLETE | Added Tier markers only. Not otherwise touched. |
| 3 | `db/migrations` | COMPLETE | COMPLETE | Untouched. Verified faithful to plan §4.1/§7.3. |
| 4 | `packages/db` | COMPLETE | COMPLETE | Untouched. |
| 5 | `packages/stats` | COMPLETE | COMPLETE | Untouched. 40 tests. |
| 6 | `policy/` | PARTIAL | **COMPLETE** | Added the missing Lighthouse regression check + 7 tests. Brand-voice turned out to be implemented inside `quality-threshold.ts` — kept as-is, noted in OPEN-QUESTIONS §2.3. |
| 7 | `packages/llm` | COMPLETE | COMPLETE | Untouched. |
| 8 | `ingest/` | COMPLETE | COMPLETE | Untouched. |
| 9 | `agents/` | PARTIAL | **COMPLETE¹** | Built `worker.ts`, the role registry, the Operator role substantively, and Analyst/Scout/Strategist as Tier C. 7 worker tests. |
| 10 | `site/` | MISSING | **COMPLETE²** | Full Astro site: collections, 3 layouts, 4 components, JSON-LD, sitemap, robots, 3 template articles. 11 schema tests. |
| 11 | `.github/workflows/` | MISSING | **COMPLETE** | All 6 workflows. |
| 12 | `scripts/` | MISSING | **COMPLETE** | All 8 declared scripts (every one was previously broken) plus `policy-state.ts`. |
| 13 | Documentation | MISSING | **COMPLETE** | README, SETUP, architecture, runbook, 5 ADRs. |
| — | `OPEN-QUESTIONS.md` | MISSING | **COMPLETE** | All four sections. Nothing to merge — the previous session never started it. |

¹ ² See "What remains".

## Defects found and fixed along the way

- **`pnpm lint` failed on a clean checkout** — `no-unused-vars` rejected the
  previous session's destructure-to-omit in `rungs.test.ts`. Fixed the ESLint
  config rather than the test, preserving the test's intent.
- **Unroutable jobs were parked, not failed.** The worker's "no handler" throw
  sat outside its try block, so `fail()` never ran and the job stayed `running`
  until the reaper found it. Caught by a test written for exactly that case.
- **Every one of the 8 `pnpm` scripts declared in `package.json` was broken** —
  the files did not exist and the root package had no dependencies to resolve.
- **`scripts/` was silently untypechecked.** `pnpm -r typecheck` only visits
  workspace packages.
- **CI ran typecheck and test before build**, which fails on a clean runner
  because workspace packages resolve through their built `dist/` declarations.
  Reordered `ci.yml` and added a build step to the five workflows that run code.
- **`@astrojs/sitemap` floated to 3.7.3**, which crashes against Astro 4. Pinned.

## No secrets

`.env.example` contains only placeholders. All 16 env vars read in code are
declared there, and every read goes through `requireEnv`/`optionalEnv`. A scan
for key patterns (`sk-ant-`, `phc_`, `phx_`, `ghp_`, `github_pat_`, PEM blocks)
across all source, config, and docs returns nothing. `.env` is gitignored and
untracked. **Nothing needs rotating.**

## What remains

Two done-conditions could not be met in this environment. Both need
infrastructure, not code.

1. **Item 9 — "worker loop demonstrably processes a seeded job end to end
   against a local Postgres."** No Postgres was available. The loop has 7 unit
   tests with the data layer mocked, covering freeze behavior, unroutable jobs,
   handler failure, and unknown tenants. The end-to-end run is SETUP.md step 10:

   ```bash
   pnpm db:migrate && pnpm db:seed
   pnpm queue:enqueue --role operator --kind health-check
   pnpm --filter @atlas/agents worker --role operator
   ```

2. **Item 10 — Lighthouse 95+ mobile (plan §3.2).** The site builds to 8 static
   pages with valid JSON-LD and correct heading hierarchy, which satisfies the
   prompt's stated done-condition (`pnpm --filter site build` succeeds). It has
   not been *measured*, because that needs a deployed URL. SETUP.md steps 5 and
   11.

Beyond those, everything Tier B in the repo is unverified against live services
by definition — that is what Tier B means, and it is inventoried in
[OPEN-QUESTIONS.md §3](OPEN-QUESTIONS.md), not here.

**Delete this file once both items above are ticked.**
