# Claude Code Prompt — Atlas OS Repository Scaffold

**How to use this:** copy everything below the line into Claude Code as your first message. Before you do, put the two spec documents in the repo at `docs/atlas-os-spec-v2.md` and `docs/atlas-os-implementation-plan.md` — the prompt tells Claude Code to read them, and it will do much better work with them present than without.

---

## PROMPT — copy from here

You are scaffolding a greenfield repository for a project called **Atlas OS**. The GitHub repo already exists and is empty:

```
https://github.com/cadendane-droid/AutonomousCompany.git
```

Read `docs/atlas-os-spec-v2.md` and `docs/atlas-os-implementation-plan.md` first. They are the authoritative specification. This prompt tells you what to build; those documents tell you why, and where there is any conflict between this prompt and the specs, follow the specs and note the discrepancy in your final report.

### What Atlas OS is, in one paragraph

An autonomous publishing system that runs an affiliate content website as a self-improving company. AI agents propose changes, a deterministic Policy Engine gates them, everything is measured and recorded, and the system's maturity is gated on traffic volume — it deliberately does *not* run experiments until it has enough traffic to power them. The repository you are building is Stages 0 through 4 of the implementation plan.

---

## GROUND RULES — these govern everything below

**1. Never block. Ever.**
You will encounter dozens of unknowns: the niche hasn't been chosen, no API credentials exist, the domain isn't decided. Do not stop and ask. For every unknown:

- Pick a sensible, clearly-marked placeholder
- Make it a single-source-of-truth constant or config value so it can be changed in one place
- Add a `# TODO(setup):` comment explaining exactly what to replace it with
- Append an entry to `OPEN-QUESTIONS.md`
- Keep going

The only acceptable end state is a complete scaffold plus a list of questions. An incomplete scaffold with questions asked mid-way is a failure.

**2. Placeholder conventions.**
Use these consistently so they're greppable:

| Unknown | Placeholder |
|---|---|
| Tenant slug | `tenant-alpha` |
| Domain | `example-tenant.com` |
| Niche / vertical | `PLACEHOLDER_NICHE` |
| Any secret or key | env var, referenced in `.env.example`, never a literal |
| Affiliate program | `PLACEHOLDER_PROGRAM` |

Every placeholder gets a `TODO(setup):` comment. At the end, `grep -r "TODO(setup)"` must return a complete list of everything a human needs to fill in.

**3. Working code over stubs, but stubs over nothing.**
Three tiers, and be explicit in code comments about which tier each module is:

- **Tier A — fully working now.** No external dependencies beyond the repo. Build these completely and test them.
- **Tier B — working logic, unverified against a live service.** API clients, DB queries. Write the real implementation against documented API shapes. Mark `// TIER B: logic complete, untested against live API`.
- **Tier C — interface only.** Where the shape genuinely can't be known yet. Typed interface, throws `NotImplementedError`, documented. Use sparingly and justify each one.

**4. Secrets.**
No credentials in the repo, ever. `.env.example` with every variable documented. `.env` in `.gitignore`. If you need a value to make something run, read from env with a clear failure message naming the missing variable.

**5. Commit as you go.**
Logical commits with conventional-commit messages, not one giant commit. Push to `main`.

**6. Type safety and validation.**
TypeScript throughout, strict mode. Zod for all runtime boundaries: frontmatter parsing, env vars, API responses, agent outputs. An agent returning malformed JSON must fail loudly at the boundary, not silently propagate.

---

## STACK — already decided, do not re-litigate

| Layer | Choice |
|---|---|
| Language | TypeScript, Node 20+, ESM |
| Package manager | pnpm, workspaces |
| Site | Astro 4+, static output, content collections |
| Database | Supabase (Postgres + pgvector) |
| Job queue | **Postgres table with `FOR UPDATE SKIP LOCKED`. No Redis.** |
| Scheduler | GitHub Actions cron (primary), pg_cron (documented alternative) |
| Hosting | Vercel |
| Product analytics | PostHog |
| Search data | Google Search Console API |
| LLM | Anthropic API, via a tiered router |
| Testing | Vitest |
| Linting | ESLint + Prettier |

Monorepo with pnpm workspaces. Shared types in a `packages/core` workspace consumed by everything else — do not duplicate type definitions across packages.

---

## TARGET STRUCTURE

```
AutonomousCompany/
├── README.md
├── OPEN-QUESTIONS.md
├── SETUP.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── .editorconfig
│
├── docs/
│   ├── atlas-os-spec-v2.md            # already present
│   ├── atlas-os-implementation-plan.md # already present
│   ├── architecture.md                 # you write: how this repo maps to the spec
│   ├── runbook.md                      # you write: operating procedures
│   └── adr/
│       └── 0001-record-architecture-decisions.md
│
├── brand/
│   ├── rules.md
│   ├── protected-paths.yml
│   ├── quality-rubric.md
│   └── disclosure.md
│
├── policy/
│   ├── rules.yml
│   ├── src/
│   │   ├── index.ts
│   │   ├── checks/
│   │   │   ├── blast-radius.ts
│   │   │   ├── protected-paths.ts
│   │   │   ├── frontmatter.ts
│   │   │   ├── disclosure.ts
│   │   │   ├── internal-links.ts
│   │   │   ├── schema-markup.ts
│   │   │   ├── freeze-state.ts
│   │   │   ├── concurrency.ts
│   │   │   ├── power-check.ts
│   │   │   ├── rollback-declared.ts
│   │   │   └── quality-threshold.ts
│   │   ├── proposal-parser.ts
│   │   ├── config.ts
│   │   └── report.ts
│   └── test/
│
├── packages/
│   ├── core/                  # shared types, zod schemas, constants
│   ├── db/                    # client, typed queries, migration runner
│   ├── stats/                 # power, DiD, anomaly detection, health score
│   └── llm/                   # router, Anthropic client, cost tracking
│
├── ingest/
│   └── src/
│       ├── search-console/
│       ├── posthog/
│       ├── affiliate/
│       ├── technical/
│       ├── external-events/
│       └── runner.ts
│
├── agents/
│   └── src/
│       ├── worker.ts
│       ├── queue.ts
│       ├── context.ts
│       ├── roles/
│       │   ├── builder/
│       │   ├── operator/
│       │   ├── analyst/
│       │   ├── scout/
│       │   └── strategist/
│       ├── prompts/
│       └── proposals/
│
├── db/
│   ├── migrations/
│   └── seed/
│
├── site/
│   ├── astro.config.mjs
│   ├── src/
│   │   ├── content/
│   │   │   ├── config.ts
│   │   │   └── tenant-alpha/
│   │   │       ├── guides/
│   │   │       ├── reviews/
│   │   │       └── comparisons/
│   │   ├── components/
│   │   ├── layouts/
│   │   └── pages/
│   └── public/
│
├── scripts/
│
└── .github/
    └── workflows/
```

---

## BUILD ORDER

Work in this sequence. Each item lists what "done" means.

### 1. Repo foundation
Workspace config, base tsconfig with strict mode, ESLint, Prettier, gitignore, editorconfig, `.env.example` with every variable you introduce anywhere documented with a comment explaining where to obtain it.

**Done:** `pnpm install && pnpm build && pnpm test` succeeds from clean checkout.

### 2. `packages/core`
Every shared type and Zod schema in one place:

- `Tenant`, `Page`, `Decision`, `Job`, `AgentRun`, `Proposal`, `Cohort`, `Experiment`, `ExternalEvent`
- Frontmatter schema exactly matching implementation plan §3.1, including the nested `atlas` block
- Enums: `Rung` (0–3), `RoleName`, `ModelTier`, `DecisionKind`, `RiskTier`, `KnowledgeTier` (decision / working-belief / principle)
- Rung definitions as data: for each rung, the traffic threshold, allowed experiment methods, max concurrency, and which knowledge tiers can be promoted. **The maturity ladder must be a data structure the Policy Engine reads, not logic scattered across files.**

**Done:** every other package imports from here; zero duplicated type definitions.

### 3. `db/migrations`
Numbered, idempotent, forward-only SQL. Transcribe the schema from implementation plan §4.1, §6.1, §7.3, §9.1 exactly — do not improvise column names, other code will be written against them.

Migrations:
1. `0001_extensions.sql` — pgvector, pgcrypto
2. `0002_tenants.sql`
3. `0003_pages.sql`
4. `0004_metrics.sql` — search, behavior, affiliate, technical
5. `0005_external_events.sql`
6. `0006_jobs.sql` — jobs, agent_runs
7. `0007_decisions.sql` — includes `embedding vector(1536)`
8. `0008_system_state.sql` — freeze flag, reason, timestamp, set_by
9. `0009_ingest_runs.sql`
10. `0010_cohorts_experiments.sql` — Rung 1+, create now, unused until then
11. `0011_knowledge.sql` — tiered knowledge base with scope column (`tenant` | `platform`)
12. `0012_indexes.sql`
13. `0013_views.sql` — health score components, refresh queue, dashboard reads

Every table carries `tenant_id`. `decisions.rollback_ref` is `NOT NULL` — Law 2 enforced at the database level. `decisions.measurable` is a required boolean with no default, so honesty is forced rather than defaulted.

Include a plain-Node migration runner in `packages/db` that tracks applied migrations in a `schema_migrations` table. Do not depend on the Supabase CLI.

**Done:** migrations apply cleanly to a fresh Postgres and are individually reversible in documentation if not in code.

### 4. `packages/db`
Typed client, connection from env, migration runner, and query modules per domain (pages, decisions, metrics, jobs, knowledge). Queries in named exported functions with typed returns — no ad-hoc SQL strings in agent or ingest code.

Include a `SKIP LOCKED` queue implementation: `enqueue`, `claim(role, limit)`, `complete`, `fail(retry)`, `heartbeat`.

**Done:** Tier B. Compiles, typed end to end, obviously correct on read.

### 5. `packages/stats` — highest-value pure code, build it properly
All Tier A, all unit tested. This is the code that keeps the system honest.

- `power.ts` — required sample size for two-proportion test, `n ≈ 16σ²/δ²` as the baseline, plus a proper normal-approximation implementation. Function `achievablePower({ baselineRate, mde, trafficPerArm, durationDays })`. **This is what the Policy Engine calls to reject underpowered experiments.** Include the effect-size table from spec §4 as a test fixture and assert your implementation reproduces it.
- `did.ts` — difference-in-differences with confidence intervals, for split-URL cohort tests.
- `anomaly.ts` — rolling 28-day baseline, z-score, day-of-week adjustment, **volume floor below which the metric is declared too noisy to evaluate.** The floor matters more than the detector; at low traffic almost everything is noise.
- `health-score.ts` — phase-weighted composite from spec §3. Weights as a data table keyed by rung. Any component with under 30 days of stable measurement is excluded and remaining weights renormalize.
- `cohorts.ts` — stratified randomization by impression tertile, page type, cluster; plus a balance check on pre-period metrics.

**Done:** `pnpm test` passes with meaningful assertions, including edge cases at zero and low traffic.

### 6. `policy/` — the core of the system
A CLI that takes a PR diff plus a proposal body and returns pass/fail with a structured report. Runs as a GitHub Action and blocks merges.

`policy/rules.yml`: transcribe implementation plan §5.2 in full.

Implement every check in the table at implementation plan §5.3. Deterministic checks are Tier A and must be genuinely working. Model-evaluated checks (quality score, brand voice) call `packages/llm` and are Tier B.

Critical design requirements:

- **Fail closed.** Any check that errors is a failure, not a pass.
- **No check may be skipped by anything in the PR itself.** No magic commit-message overrides, no skip labels an agent could apply. Human approval is expressed through GitHub's own review mechanism, not through content the agent controls.
- Structured output: markdown for the PR comment, JSON for the database.
- `proposal-parser.ts` parses the structured PR body from implementation plan §6.3 and validates with Zod. A malformed proposal is a policy failure.
- The power check reads the current rung from the tenant record and rejects any experiment proposal whose stated MDE is unreachable at available traffic.

**Done:** Tier A, runnable locally as `pnpm policy:check --diff <file> --proposal <file>`, with tests covering both pass and fail paths for each check.

### 7. `packages/llm`
Anthropic client plus the tiered router from implementation plan §6.2.

- Router: task kind → tier (`rules` | `local` | `cloud-small` | `cloud-capable` | `reasoning`). Task→tier mapping as a config table, not a switch statement.
- Every call logs to `agent_runs` with tokens, cost, duration, tier, outcome.
- Structured output helper: prompt for JSON, parse, validate against a Zod schema, retry once on failure, then fail loudly.
- Monthly budget cap read from env, with automatic degradation to cheaper tiers as the cap approaches, and a hard stop.

**Do not hardcode model identifiers scattered through the code.** One config file, one place to change. If you are unsure which model names are current, define the config with clearly-marked placeholder constants and put it in `OPEN-QUESTIONS.md` — do not guess and bury the guess.

**Done:** Tier B. Router logic fully unit tested with a mocked client.

### 8. `ingest/`
One module per connector, each exposing `run(tenantId, dateRange)`, writing to its metrics table, and recording an `ingest_runs` row with row counts.

- **search-console** — service-account auth, page + query + country + device dimensions, pagination, 2–3 day lag handled, backfill mode for initial 16-month pull.
- **posthog** — nightly aggregation into `behavior_metrics`.
- **affiliate** — abstract `AffiliateProvider` interface with a CSV-import reference implementation, since programs vary and none is chosen yet.
- **technical** — Lighthouse CI runner over a sample of page types; Vercel Speed Insights client.
- **external-events** — scheduled check for algorithm updates, plus a CLI for manual entry. This table is the confounder record every future measurement depends on; make manual entry easy.
- **runner.ts** — dispatch, retry with backoff, staleness assertion that raises a job when a connector produces zero rows where it previously produced many.

**Done:** Tier B throughout, with the interfaces and error handling complete.

### 9. `agents/`
The runtime. Boring on purpose.

- `worker.ts` — claim jobs via `SKIP LOCKED`, dispatch to role handler, record `agent_runs`, handle failure and retry, respect freeze state.
- `context.ts` — assemble context per role: relevant metrics, recent decisions, **semantic recall of similar past decisions via pgvector**, brand rules, current rung and its constraints. This module quietly determines output quality more than any prompt does; give it real attention.
- `roles/` — one directory each for builder, operator, analyst, scout, strategist. Each exports handlers keyed by job kind, with its own system prompt in `prompts/`.
- `proposals/` — construct the structured PR body, open the PR via the GitHub API, attach the proposal, link it to a `decisions` row.

Build **builder** and **operator** substantively (implementation plan §6.3–6.4), including builder's six-step content pipeline with the separate non-optional fact-check pass. Scaffold **analyst**, **scout**, **strategist** as complete interfaces with real system prompts but Tier C handlers — they are Stage 5–6 work.

Write the system prompts properly, in `prompts/*.md`, loaded at runtime. Each must state the role's scope, its constraints, that its output goes through the Policy Engine, and — for builder — that fabricating a factual claim is the most serious error it can make.

**Done:** worker loop is Tier A and demonstrably processes a seeded job end to end against a local Postgres.

### 10. `site/`
Astro, static output. Content collections with the frontmatter schema from `packages/core`. Content directory scoped by tenant: `src/content/tenant-alpha/`.

- Layouts: base, article, comparison
- Components: `AffiliateDisclosure` (required on monetized pages, enforced by policy), `AffiliateLink` (sub-ID parameter encoding page slug), `Breadcrumbs`, `SourcesList`
- Schema markup: Article, Product, Breadcrumb, FAQ — generated from frontmatter
- Sitemap and robots.txt generated at build
- Semantic HTML, correct heading hierarchy, no layout shift
- **Three example articles** — one per type — with fully populated frontmatter, realistic structure, and `PLACEHOLDER_NICHE` content. These are format templates for the builder agent, so make the structure exemplary even though the prose is filler.

**Done:** `pnpm --filter site build` succeeds, output is valid static HTML, Lighthouse-ready.

### 11. `.github/workflows/`
- `policy-check.yml` — on PR, runs the Policy Engine, comments the report, blocks merge on failure
- `ci.yml` — lint, typecheck, test, build on push and PR
- `ingest-daily.yml` — cron, runs all connectors, opens an issue on failure
- `health-check.yml` — cron, operator health check
- `lighthouse.yml` — cron, technical metrics sample
- `agent-worker.yml` — manual dispatch and cron, drains the job queue

All secrets referenced as `${{ secrets.NAME }}` and documented in `SETUP.md`.

### 12. `scripts/`
`db:migrate`, `db:seed`, `tenant:create`, `content:validate`, `content:score`, `decisions:log`, `queue:enqueue`, `policy:check`. Wire all as pnpm scripts at the root.

### 13. Documentation
- `README.md` — what this is, architecture at a glance, quickstart, current rung and what that gates, repo map.
- `SETUP.md` — ordered checklist to go from clone to running: every account to create, every env var, every secret, in dependency order. Assume the reader knows nothing about the project.
- `docs/architecture.md` — how this repo maps onto the spec, why Git-as-source-of-truth, why no Redis, where the rung gates are enforced.
- `docs/runbook.md` — how to run a migration, how to freeze and unfreeze the system, how to roll back a deploy, how to add a tenant, what to do when a connector fails, how to review an agent PR.
- `docs/adr/0001` — the ADR template plus records for: Git as source of truth, Postgres queue over Redis, Policy Engine as CI check, multi-tenant schema from day one.

---

## EXPLICITLY DO NOT

- Do not choose the niche, write real content, or invent product facts. `PLACEHOLDER_NICHE` everywhere.
- Do not build experiment execution, A/B assignment, or split-URL test running. Those are Rung 1–2. Create the tables, nothing more.
- Do not add Redis, Kubernetes, a message broker, or a microservice split.
- Do not build a dashboard beyond the Postgres views. No React app.
- Do not create the 17-agent hierarchy from the v1.0 spec. Five roles, per v2.0 §9.
- Do not add an override mechanism to the Policy Engine that an agent could invoke.
- Do not write a confidence score anywhere outside a Tier 3 knowledge record.
- Do not stop to ask questions.

---

## FINAL DELIVERABLE

When the scaffold is complete and pushed, produce **`OPEN-QUESTIONS.md`**, organized as:

**Section 1 — Blocking.** Things that must be answered before the system can run at all. Niche, tenant slug, domain, credentials. For each: what you need, why, what placeholder you used, and which files change when it's answered.

**Section 2 — Decisions I made for you.** Every judgment call, with your reasoning and what it would take to reverse it. Be thorough here — this is where a scaffold usually hides its assumptions.

**Section 3 — Needs verification.** Anything Tier B where you implemented against documented API shapes without being able to test. Model identifiers, API response shapes, anything you were less than confident about.

**Section 4 — Deliberately deferred.** What you didn't build and which stage or rung it belongs to.

Then, in your closing message: what you built, what works today versus what needs credentials, the exact commands to verify the build locally, and the single next action a human should take.

Begin.
