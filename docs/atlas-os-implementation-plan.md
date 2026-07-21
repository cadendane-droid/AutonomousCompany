# Atlas OS — Implementation Plan

**Companion to:** Atlas OS Master Specification v2.0
**Scope:** Stage 0 through Rung 2, plus the second-tenant transition

---

## 0. Framing: The Two Failure Modes

Before any sequencing, name what kills this project. There are two failure modes and they pull in opposite directions.

**Failure Mode A — Build the OS, never build the site.**
Six months of orchestrators, event queues, and agent runtimes, and the website has eleven articles and no traffic. The infrastructure is beautiful and measures nothing. This is the more likely failure for anyone who enjoys building systems, which is almost certainly why this document exists.

**Failure Mode B — Ship content fast, build nothing.**
A pile of AI articles, no measurement, no rollback, no memory. Indistinguishable from every other affiliate site, and the whole premise is abandoned.

The plan below is structured to avoid A specifically, because that's the one this project is predisposed toward. **The rule: content ships in Week 1 and never stops shipping while infrastructure is built around it.** Infrastructure work happens on the side of a site that is already alive. Every stage below has a parallel content track that is not optional and not deferrable.

A second framing point: **the site's traffic curve is the binding constraint, not the build velocity.** A new site in a competitive niche takes 6–18 months to reach 1,000 sessions/month regardless of how good the OS is. That means there is genuinely time to build this properly — but it also means the infrastructure cannot accelerate the thing that matters most in year one. Content quality and topical coverage do that. Plan accordingly.

---

## 1. Stack Decision

The single largest lever on effort is **buying rather than building the measurement and deployment layers.** The v2.0 architecture diagram describes capabilities, not components to write from scratch. Roughly 60% of it is off-the-shelf.

| Layer | Spec calls for | Recommendation | Build or buy |
|---|---|---|---|
| Website | Production site | Astro or Next.js, static-first, in a Git repo | Build (thin) |
| Hosting / deploy | Deployment + rollback | Vercel — preview deploys, instant rollback, runtime logs | **Buy** |
| Source of truth | Page versions, reversibility | **Git.** Every change is a commit; rollback is a revert | **Buy** |
| Database | PostgreSQL + pgvector | Supabase | **Buy** |
| Event queue | Redis | **Postgres job table with `SKIP LOCKED`.** Skip Redis entirely at this scale | Build (trivial) |
| Scheduler | Automation agent | `pg_cron` on Supabase, or GitHub Actions cron | **Buy** |
| Product analytics | User behavior, heatmaps, scroll, session replay | PostHog | **Buy** |
| Feature flags / A/B | Experiment infrastructure | PostHog experiments + flags | **Buy** |
| Search data | Impressions, clicks, CTR, position | Google Search Console API | Build ingest only |
| Technical monitoring | CWV, Lighthouse, errors | Vercel Speed Insights + scheduled Lighthouse CI | **Buy** |
| Policy Engine | Non-negotiable rules | **GitHub Actions CI check that blocks merges** | Build — core |
| Knowledge base | Tiered decision memory | Postgres tables + pgvector | Build — core |
| Agent runtime | Orchestrator + roles | Single worker process, Claude API | Build — core |
| Human dashboard | Strategist view | Start with a Postgres view + one page. Not a product. | Build (thin) |

**What you actually write:** the Policy Engine, the knowledge base schema and promotion logic, the agent runtime, the Search Console ingest, and the site itself. That is a tractable amount of code. Everything else is configuration.

**The most important single decision in this table:** the site lives in Git, and agents ship changes as pull requests. This gives you, for free and without writing a line: complete version history of every page, atomic rollback, diffs for review, preview environments per change, and a CI hook where the Policy Engine can sit. Law 2 (every change reversible) becomes a property of the storage layer rather than something the system has to remember to do.

**Effort assumption used throughout:** one competent builder working with AI coding assistance, roughly 15–20 focused hours per week. Multiply or divide accordingly.

**Running cost at Rung 0–1:** roughly $80–250/month. Supabase Pro ~$25, Vercel Pro ~$20, PostHog free tier (generous — 1M events/mo), domain and misc ~$20, LLM inference $30–150 depending on content volume and how disciplined the router is.

---

## 2. Stage 0 — Decisions Before Code

**Duration:** 1 week. **Output:** a decisions document, committed to the repo.

Nothing here is code, and skipping it is expensive later.

### 2.1 Niche selection

This is the highest-leverage decision in the entire project and no amount of system quality compensates for getting it wrong. Criteria:

- **Enough pages to test on.** The split-URL methodology needs 100+ comparable pages. A niche that tops out at 40 meaningful articles can never reach Rung 1 measurement. Model the full page inventory before committing.
- **Affiliate programs with usable tracking.** Sub-ID support is required, or revenue can never be attributed to a page and the health score's revenue component is fiction.
- **Not YMYL.** Health, finance, and legal niches face elevated quality thresholds and make AI-assisted production far riskier. Avoid entirely at this stage.
- **Tolerable competition.** Check whether the top 10 for your head terms are all major publishers. If so, pick something else.
- **Genuine product churn.** Niches where products update annually create a natural refresh cycle and defensible reason to exist.

### 2.2 Scope and kill criteria

Write these down now, while you're unbiased, and put dates on them:

| Checkpoint | Condition to continue | If not met |
|---|---|---|
| Month 3 | 40+ articles indexed, any impressions trend | Re-examine niche or content quality |
| Month 6 | 500+ sessions/month, first affiliate clicks | Niche likely wrong — pivot before building more |
| Month 12 | 3,000+ sessions/month, non-zero revenue | Decide: continue, pivot, or stop |
| Month 18 | Rung 1 measurement running, principles accruing | Reassess whether the OS thesis holds |

The point of pre-committing is that at month 6 you will have sunk cost and will rationalize. Write the criteria before you have anything to defend.

### 2.3 Brand rules document

A versioned Markdown file in the repo — `brand/rules.md` — covering voice, prohibited patterns, disclosure requirements, factual sourcing standards, and the protected-page list. This is the artifact the Policy Engine enforces. Brand does not get an agent; it gets a file with constraints that cannot be argued with.

### 2.4 Content quality rubric

The Rung 0 feedback loop, so it must exist before content does. Five dimensions, 1–5 each, with written anchors for what a 1 and a 5 look like:

1. Factual verifiability — claims traceable to named sources
2. Intent coverage — does it answer what the query actually wants
3. Structural completeness — no obvious gaps a knowledgeable reader would notice
4. Information originality — does it contain anything not in the top 10 results
5. Readability and scannability

**Anchor with human-scored examples.** Write or find three articles yourself, score them, and use those as calibration examples in the evaluator prompt. An unanchored LLM rubric drifts toward scoring everything a 4.

---

## 3. Stage 1 — Site Alive, Content Shipping

**Duration:** weeks 1–3. **Exit criteria:** site deployed, Search Console verified, 5 articles published, deploy-and-rollback proven.

This stage exists to make Failure Mode A structurally impossible. The site is live and publishing before any agent infrastructure exists.

### 3.1 Repository structure

Establish this now — the agent runtime is built against it later, so changing it costs rework.

```
atlas/
├── site/                    # the website (Astro/Next)
│   ├── content/
│   │   └── {tenant}/        # tenant-scoped from day one
│   │       ├── guides/
│   │       ├── reviews/
│   │       └── comparisons/
│   ├── components/
│   └── src/
├── brand/
│   ├── rules.md
│   ├── protected-paths.yml
│   └── quality-rubric.md
├── policy/                  # Policy Engine (Stage 3)
│   ├── rules.yml
│   └── check.ts
├── agents/                  # runtime (Stage 4)
├── ingest/                  # data connectors (Stage 2)
├── db/
│   └── migrations/
└── .github/workflows/
```

**Content as Markdown files with frontmatter**, not database rows. This keeps Git as the source of truth for the thing that matters most and means an agent editing a page produces a reviewable diff.

Frontmatter schema — include `atlas` metadata from the first article, even though nothing reads it yet:

```yaml
---
title: "..."
slug: "..."
type: "buying-guide"          # drives cohort stratification later
cluster: "tents"              # topical grouping
published: 2026-08-14
updated: 2026-08-14
atlas:
  tenant: "alpine-gear"
  quality_score: null
  cohort: null                # assigned when split-URL testing begins
  protected: false
  last_decision_id: null
---
```

Backfilling this across 80 articles later is tedious and error-prone. It costs nothing now.

### 3.2 Site build

Static-first. Server-rendered pages add latency, complexity, and CWV risk for no benefit on a content site. Requirements:

- Clean semantic HTML, working heading hierarchy
- Article, Product, Breadcrumb, and FAQ schema where applicable
- Sitemap and robots.txt generated at build
- Affiliate disclosure component, present on every monetized page
- Sub-ID parameter in every affiliate link, encoding page slug
- Lighthouse 95+ on mobile before the first article ships

Do not build a comparison table component, a calculator, or a newsletter system yet. Those are Rung 1–2 concerns.

### 3.3 Deploy and rollback, proven

Connect Vercel to the repo. Then **deliberately break production and roll it back.** Time it. Write down the procedure. This is the mechanism Law 2 depends on and you need to know it works before an autonomous system relies on it.

### 3.4 Parallel track — content

Five articles this stage, then a steady cadence you can actually sustain. Write them yourself or heavily edit AI drafts. These are the calibration set for the quality rubric and you need to know what good looks like in this niche before delegating it.

---

## 4. Stage 2 — The Data Spine

**Duration:** weeks 3–6. **Exit criteria:** Search Console, PostHog, and technical metrics all landing in Postgres daily, on an automated schedule, with backfill complete.

This is Principle 3 (everything becomes data) and it is the piece that cannot be retrofitted. Every day this isn't running is a day of history permanently lost. Build it before anything analytical, even though nothing will analyze it for months.

### 4.1 Schema — foundation tables

Multi-tenant from the first migration. Adding `tenant_id` later is a painful migration; adding it now is a column.

```sql
create table tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  domain        text not null,
  niche         text,
  launched_at   date,
  rung          int not null default 0,     -- maturity ladder position
  created_at    timestamptz default now()
);

create table pages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  slug          text not null,
  path          text not null,
  type          text not null,              -- buying-guide | review | comparison
  cluster       text,
  protected     boolean default false,
  published_at  date,
  updated_at    date,
  quality_score numeric,
  cohort_id     uuid,                       -- null until split-URL testing
  unique (tenant_id, path)
);

-- daily search metrics, one row per page per query per day
create table search_metrics (
  tenant_id     uuid not null references tenants(id),
  page_id       uuid references pages(id),
  date          date not null,
  query         text,
  country       text,
  device        text,
  impressions   int not null default 0,
  clicks        int not null default 0,
  position      numeric,
  primary key (tenant_id, date, page_id, query, country, device)
);

create table behavior_metrics (
  tenant_id       uuid not null references tenants(id),
  page_id         uuid references pages(id),
  date            date not null,
  sessions        int,
  users           int,
  returning_users int,
  bounce_rate     numeric,
  avg_duration    numeric,
  scroll_depth_p50 numeric,
  exits           int,
  primary key (tenant_id, date, page_id)
);

create table affiliate_metrics (
  tenant_id     uuid not null references tenants(id),
  page_id       uuid references pages(id),
  date          date not null,
  clicks        int default 0,
  conversions   int default 0,
  revenue       numeric default 0,
  primary key (tenant_id, date, page_id)
);

create table technical_metrics (
  tenant_id     uuid not null references tenants(id),
  page_id       uuid references pages(id),
  date          date not null,
  lcp           numeric,
  cls           numeric,
  inp           numeric,
  lighthouse    int,
  indexed       boolean,
  crawl_errors  int,
  primary key (tenant_id, date, page_id)
);

-- external events that confound everything: algorithm updates, seasonality,
-- competitor moves, affiliate program changes
create table external_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id),   -- null = platform-wide
  date          date not null,
  kind          text not null,                 -- algo_update | seasonal | competitor | program_change
  description   text,
  severity      text,
  source        text
);
```

`external_events` is the table people forget and then desperately need. Every measurement you make later will need to answer "was there a confounder in this window," and that question is unanswerable retroactively.

### 4.2 Connectors

**Search Console.** Service account, daily pull, page + query dimensions. Notes that will bite you otherwise: data lags 2–3 days, the API retains only 16 months, and row limits mean you paginate. Backfill everything available on the first run — that history is free now and gone later.

**PostHog.** Install the snippet during Stage 1 so collection starts immediately. Nightly aggregation query into `behavior_metrics`. Enable session replay and heatmaps now even though nobody looks at them until Rung 1; the recordings are only useful if they exist.

**Affiliate.** Programs vary wildly. Some have APIs, some have CSV exports, some have nothing but a dashboard. Whatever it is, get it into `affiliate_metrics` daily. If a program offers no per-page attribution, that program's revenue cannot inform any page-level decision — know that up front rather than discovering it during your first CRO test.

**Technical.** Vercel Speed Insights for field CWV; scheduled Lighthouse CI run against a sample of page types for lab data.

**External events.** Semi-manual is fine and honest. A scheduled job checks the Google Search Status dashboard and a couple of industry feeds, files a row, and pings you. You will also add rows by hand. That's acceptable.

### 4.3 Scheduling

`pg_cron` or GitHub Actions, one job per connector, staggered. Every run writes to `ingest_runs` with status and row counts. A connector that silently stops is worse than one that never existed, because you'll trust the gap as a real signal.

### 4.4 Parallel track — content

Continue publishing. Target 15–20 total articles by end of stage, clustered tightly around one or two topics rather than scattered. Topical density beats breadth early.

---

## 5. Stage 3 — Policy Engine and Deployment Safety

**Duration:** weeks 6–9. **Exit criteria:** no change can reach production without passing deterministic checks; rollback is automated and tested.

Built before any agent exists, so that the first autonomous change is born into constraints rather than having them added afterward.

### 5.1 The core insight

**The Policy Engine is a CI check, not a service.** Agents propose changes as pull requests. A GitHub Action evaluates the diff against `policy/rules.yml` and blocks the merge on violation. This is deterministic, auditable, impossible to talk around, and it runs before anything reaches even a preview environment.

An LLM cannot negotiate with a failing CI check. That property is the entire point.

### 5.2 Rules configuration

```yaml
# policy/rules.yml
blast_radius:
  max_files_changed: 5
  max_lines_changed: 800
  max_new_pages_per_week: 8
  max_deletions_per_pr: 1

protected:
  paths:
    - site/content/*/index.md
    - site/components/Nav.*
    - site/components/AffiliateDisclosure.*
    - brand/**
  requires: human_approval

brand:
  navigation_changes_per_quarter: 1
  voice_rules_file: brand/rules.md
  required_components:
    monetized_pages: [AffiliateDisclosure]

experiments:
  max_concurrent_by_rung: { 0: 0, 1: 1, 2: 3, 3: 10 }
  require_power_check: true
  require_guardrails: true
  min_duration_days_by_type:
    conversion: 14
    ctr: 42
    ranking: 56

freeze:
  on_algorithm_update: true
  on_traffic_anomaly_sigma: 3
  on_revenue_drop_pct: 20
  manual_override: human_only

content:
  min_quality_score: 3.5
  require_frontmatter_fields: [title, type, cluster, tenant]
  require_sources_section: true
```

### 5.3 Checks to implement

| Check | Type | Blocks on |
|---|---|---|
| Diff size within blast radius | Deterministic | Exceeds config |
| Protected path touched | Deterministic | Any match without human approval label |
| Frontmatter valid and complete | Deterministic | Missing required fields |
| Affiliate disclosure present | Deterministic | Monetized page missing component |
| Internal links resolve | Deterministic | Any 404 |
| Schema markup validates | Deterministic | Invalid JSON-LD |
| Lighthouse on preview ≥ threshold | Deterministic | Regression > 5 points |
| Freeze state active | Deterministic | System frozen |
| Concurrent experiment cap | Deterministic | Over limit for current rung |
| **Statistical power pre-check** | Deterministic | Proposed test cannot detect its stated MDE |
| Quality score ≥ threshold | Model-evaluated | Below rubric minimum |
| Brand voice conformance | Model-evaluated | Rule violation flagged |
| Rollback condition declared | Deterministic | Missing |

The power pre-check is the mechanical enforcement of Law 9 and the reason the knowledge base stays honest. Implement it as a function taking baseline rate, MDE, available traffic, and planned duration, returning achievable power. Below 0.8, the proposal is rejected at the gate — before it can produce a meaningless number that someone later mistakes for evidence.

### 5.4 Freeze mechanism

A `system_state` table with a freeze flag, reason, and timestamp. The CI check reads it. Anomaly detection sets it automatically (Stage 5); only a human clears it. Freezing is cheap and unfreezing should require a deliberate act.

### 5.5 Automated rollback

A monitor comparing post-deploy metrics against the rollback conditions declared in the deployment record. On breach: trigger Vercel rollback to the prior deployment, revert the commit, write to `rollbacks`, notify. Test this end-to-end with a deliberately bad deploy before trusting it.

Note the timing asymmetry: conversion and technical rollbacks can fire within hours, but ranking effects take weeks. Automated rollback is only appropriate for fast-signal metrics. Slow-signal changes get scheduled review, not automatic reversion — a system that auto-reverts based on two weeks of ranking noise will thrash.

---

## 6. Stage 4 — Agent Runtime: Builder and Operator

**Duration:** weeks 9–14. **Exit criteria:** an agent can take a task from the queue, produce a content PR, pass policy checks, and merge — with a human approving each merge initially.

### 6.1 Runtime architecture

Deliberately boring. One worker process, a Postgres-backed queue, five role handlers.

```
pg_cron / webhook
      │
      ▼
   jobs table  ──── SKIP LOCKED ────▶  worker process
                                            │
                                    ┌───────┴───────┐
                                  router      role handler
                                    │               │
                              rules / local /   context assembly
                              cloud model            │
                                                proposal
                                                    │
                                            ┌───────┴───────┐
                                      content PR      db write
                                            │
                                     Policy Engine (CI)
                                            │
                                      preview → merge
```

**Skip Redis.** At the volume this system will ever operate at — dozens of jobs per day, not thousands per second — a Postgres table with `FOR UPDATE SKIP LOCKED` is a complete job queue and one less piece of infrastructure to operate. The v1.0 spec's Redis layer is premature at every rung below 3.

```sql
create table jobs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id),
  role         text not null,        -- strategist|analyst|builder|scout|operator
  kind         text not null,
  payload      jsonb,
  status       text default 'pending',
  priority     int default 5,
  attempts     int default 0,
  locked_at    timestamptz,
  created_at   timestamptz default now()
);

create table agent_runs (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references jobs(id),
  role         text,
  model_tier   text,                 -- rules|local|cloud|reasoning
  input_tokens int,
  output_tokens int,
  cost_usd     numeric,
  duration_ms  int,
  outcome      text,
  error        text,
  created_at   timestamptz default now()
);
```

`agent_runs` gives cost attribution per role from day one, which is what makes the AI router's value measurable rather than assumed.

### 6.2 The AI router

Implement early — it is simple and it compounds. A dispatch function classifying each task:

| Task | Tier | Rationale |
|---|---|---|
| Broken link detection | Rules | Deterministic crawl |
| Sitemap regeneration | Rules | Deterministic |
| Metric aggregation | Rules / SQL | Arithmetic |
| Anomaly detection | Statistical | Z-score, no model needed |
| Frontmatter validation | Rules | Schema check |
| Internal link suggestions | Local model + embeddings | Similarity search |
| Content quality scoring | Cloud, small model | Rubric application |
| Article drafting | Cloud, capable model | Generation quality matters |
| Experiment design | Cloud, reasoning | Requires actual care |
| Roadmap synthesis | Cloud, reasoning | Judgment |

Log every routing decision. Review monthly for tasks being over-served by expensive models — that review is where the savings actually materialize.

### 6.3 Builder role

**Owns:** content creation and editing, on-page changes, technical SEO fixes.

**Output is always a pull request.** Never a direct write. The PR body is structured and machine-readable, because the Policy Engine parses it and the decision log ingests it:

```markdown
## Proposal
Add comparison table to 4 buying guides in the `tents` cluster.

## Rationale
Scroll-depth data: 62% of sessions never reach the current table position.
External prior (Tier 2, tagged external-prior): above-fold comparison
tables are well-documented to improve affiliate CTR.

## Expected direction
Increase in affiliate click rate on affected pages.

## Measurable
No — current traffic 340 sessions/month. Logged as Tier 1 decision.

## Guardrails
Bounce rate, LCP.

## Rollback
Revert commit. Condition: LCP regression > 200ms, or bounce rate +10% over 30d.

## Risk
Low. 4 files, no protected paths.
```

At Rung 0, "Measurable: No" is the honest and expected answer for most proposals. The proposal is still valid — Law 7 requires a rationale and a rollback condition, not a p-value. Forcing a fabricated confidence number here is precisely the corruption Law 9 exists to prevent.

**Content pipeline within Builder:**

1. Research — gather sources, record every URL in a `sources` table
2. Outline — against target query intent
3. Draft — brand rules and cluster context in the prompt
4. Self-review against the rubric
5. Fact-check pass — every factual claim must map to a recorded source
6. Emit PR with a Sources section

The fact-check pass is separate and non-negotiable. Law 4 and the brand's trust promise both depend on it, and fabricated product specs are the single most likely way this system destroys its own credibility.

### 6.4 Operator role

**Owns:** deployments, monitoring, backups, agent health, ingest supervision.

Mostly scripts, not model calls. Nightly health check: ingest freshness, connector failures, error rates, cost against budget, backup verification, index coverage. Failures raise jobs; severe failures set freeze.

### 6.5 Human-in-the-loop, and how it retires

Start with human approval on every merge. Retire it by category, only after a track record:

| Category | Autonomy after |
|---|---|
| Broken link fixes, sitemap, schema | 20 clean runs |
| Metadata edits within one cluster | 30 clean runs |
| New article publication | 50 human-reviewed articles at quality ≥ 4.0 |
| Layout / template changes | Rung 2 + 10 clean experiments |
| Protected paths, brand, navigation | **Never** |

"Clean" means merged, no rollback, no policy violation, no quality regression within 30 days.

### 6.6 Parallel track — content

40+ articles by end of stage, an increasing share Builder-drafted and human-edited. Track your edit ratio — the fraction of Builder output you substantially rewrite. That number falling is the real signal that the content pipeline is working, and it's more informative than any quality score the system gives itself.

---

## 7. Stage 5 — Analyst: Monitoring, Anomaly Detection, Decision Log

**Duration:** weeks 14–18. **Exit criteria:** daily health snapshot computed, anomalies detected and freezing the system, every change since Stage 1 recorded in the decision log.

**Explicitly not in this stage:** experiments. There is no traffic for them. The Analyst at Rung 0 watches and records; it does not test.

### 7.1 Health score

Implement the phase-weighted score from spec §3, reading the current rung from `tenants.rung`. Compute daily, store the components separately so the composite can be recomputed if weights change.

Guard against the trap the fixed-weight version created: any component with fewer than 30 days of stable measurement is excluded and weights renormalize. A newly instrumented metric should not swing the score.

### 7.2 Anomaly detection

Statistical, not model-driven. Rolling 28-day baseline per metric, flag at 3σ, account for day-of-week seasonality, ignore metrics below a volume floor where noise dominates. At 300 sessions/month, almost everything is noise — set the floors accordingly or you'll generate constant false alarms and learn to ignore them, which is worse than having no alerting.

Confirmed anomalies raise investigation jobs and, above severity threshold, set freeze.

### 7.3 The decision log — Tier 1

The knowledge base begins here, as a record rather than a claim.

```sql
create table decisions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  date          date not null,
  role          text,
  kind          text,               -- content|technical|layout|meta|infrastructure
  summary       text not null,
  rationale     text not null,
  expected_direction text,
  affected_pages uuid[],
  measurable    boolean not null,
  measurement_plan text,
  guardrails    jsonb,
  rollback_ref  text not null,
  pr_url        text,
  outcome       text,               -- null until reviewed
  reviewed_at   date,
  embedding     vector(1536)
);
```

Two rules that matter more than they look:

- **`measurable` is a required boolean and is frequently false.** The schema makes honesty the default rather than something an agent has to choose.
- **`rollback_ref` is NOT NULL.** Law 2, enforced by the database.

Backfill everything since Stage 1. It's tedious and it's worth it — that early history is the only record of what the site looked like before it had any data.

### 7.4 Semantic recall

Embed decision summaries into pgvector. Before any agent proposes, it queries for similar past decisions and their outcomes. This is what makes Law 6 operational rather than aspirational — the knowledge base is only an asset if it's consulted at the moment of decision, not merely accumulated.

### 7.5 Dashboard

Resist building a product. A single page reading from Postgres views: health score and trend, traffic and impressions, indexation coverage, quality score distribution, recent decisions, open anomalies, freeze state, spend against budget. The spec's discipline about the CEO dashboard applies — nothing else.

### 7.6 Scout role

Add it here since it's cheap and needs no traffic: algorithm update watch, competitor page tracking, keyword opportunity scanning, reputation monitoring. Outputs are jobs and `external_events` rows, not autonomous changes.

---

## 8. Stage 6 — Content Quality Loop and Strategist

**Duration:** weeks 18–22. **Exit criteria:** every page scored and rescored, refresh queue prioritized automatically, Strategist generating a weekly roadmap you'd actually follow.

### 8.1 Quality evaluation

Run the rubric across all content. Score with the calibrated examples from Stage 0 in-prompt. **Validate against your own scoring on a 10-article holdout** — if the model's scores don't correlate with yours, the rubric or the anchoring is broken, and a broken quality score is worse than none because it drives the refresh queue.

Rescore quarterly and after every edit.

### 8.2 Refresh queue

The main use of the quality score at Rung 0. Rank pages by a composite of quality score, staleness, impressions-without-clicks, position 8–20 (near-miss pages, the highest-leverage refresh targets), and cluster importance. Feed the top N into Builder jobs weekly.

### 8.3 Strategist role

Weekly roadmap generation from health score trends, refresh queue, Scout opportunities, decision log, and the current rung's constraints. Output is a prioritized job list with reasoning, written to `roadmaps`.

Judge it by a simple test: **would you have made roughly the same calls?** If the roadmap is consistently wrong, the problem is context assembly, not model capability. Fix what it sees before reaching for a bigger model.

### 8.4 Where you are now

Roughly five months in. You have: a live site with 60–80 articles, complete data capture, a policy engine that cannot be talked around, agents producing reviewed changes, a decision log, anomaly detection, and a quality loop. Traffic is probably somewhere between 200 and 2,000 sessions/month, largely determined by niche choice rather than by anything above.

**Steps 1–7 of the spec's build order are done, and this is the majority of the durable engineering.** Everything after this waits on traffic.

---

## 9. Rung 1 Gate — Directional Measurement

**Trigger:** 1,000+ sessions/month sustained 8 weeks, **and** 100+ comparable pages. Both conditions. Neither alone is sufficient — sessions without page inventory means no cohorts, and page inventory without sessions means no signal.

**Duration once triggered:** 3–4 weeks to build, then the first test takes 10–14 weeks to read.

### 9.1 Cohort infrastructure

```sql
create table cohorts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  experiment_id uuid,
  arm           text not null,        -- treatment | control
  strata_key    text,
  page_ids      uuid[] not null,
  assigned_at   timestamptz default now()
);
```

Stratify on pre-period impressions (tertiles), page type, and cluster. Randomize within strata. Verify balance on pre-period metrics before launching — if the arms differ meaningfully before the change, re-randomize.

### 9.2 Split-URL test execution

Per spec §5.2. The measurement is difference-in-differences at minimum; CausalImpact-style Bayesian structural time series if you want proper uncertainty intervals. Both are available as libraries; do not write this yourself.

Non-negotiables, enforced by the Policy Engine:

- Minimum 8 weeks pre-period baseline
- Minimum 6 weeks post-change before reading, 8–12 preferred
- One split-URL test per page population at a time
- Algorithm update in the window invalidates the test — mark and re-run, do not salvage
- Power pre-check passes before launch

### 9.3 Working Belief tier

Add Tier 2 to the knowledge base, with promotion from Tier 1 requiring a completed measurement with a stated effect and interval. Confidence figures still do not appear — Tier 2 records effect sizes with intervals that may well include zero, described as directional.

The promotion workflow should require an explicit act, not fire automatically on a threshold. An automatic promoter will, given enough runs, promote noise.

### 9.4 First test recommendation

Make it title tags across one page type. Fast-ish signal by SEO standards, large plausible effect, trivially reversible, and it exercises the whole pipeline. Do not make your first test something you care deeply about — the first run is for debugging the methodology.

---

## 10. Rung 2 Gate — Controlled Experimentation

**Trigger:** 10,000+ sessions/month sustained 8 weeks.

**Duration:** 4–6 weeks to build.

Here the original v1.0 specification finally becomes appropriate. Everything it described was written for this rung.

**Build:**

- PostHog experiments wired to the proposal pipeline, with assignment and exposure logged into Postgres alongside everything else
- Sequential testing with pre-registered stopping rules — pre-registered meaning stored in the experiment record before launch, and enforced, not merely intended
- Guardrail monitoring with automatic rollback on fast-signal metrics
- Concurrency up to 3, with interaction checks on overlapping page populations
- Tier 3 Principle promotion: 3+ powered confirmations, 2+ independent page populations
- Full progressive rollout ladder

**Add the CRO capability set** the spec describes — affiliate placement, table design, CTA wording, comparison layouts — targeting revenue per visitor with bounce rate and dwell time as guardrails.

**The discipline that matters most at this rung:** most experiments will fail or return nothing conclusive. That is the normal and correct outcome, and the temptation to relax thresholds until things "work" will be strongest exactly here, because now you have enough traffic that it feels like it should be working. Negative results go into the knowledge base with equal weight. The competitor who runs 40 tests and records only the 6 that won has a knowledge base of noise.

---

## 11. Second Tenant — Where the Moat Starts

**Trigger:** first tenant at Rung 2, platform code stable, and — importantly — you personally have bandwidth. Two mediocre sites is worse than one good one.

This is step 14 in the spec's build order and it is where the actual defensibility begins, because a principle confirmed on one site is a hypothesis, and a principle confirmed on four independent sites is knowledge.

**Work required:**

1. Extract tenant-specific configuration — brand rules, niche parameters, affiliate programs, quality rubric weights — from platform code
2. Split the knowledge base by scope: `tenant` vs `platform`
3. Build the cross-tenant validation query: for a given claim, what does the evidence look like across all tenants
4. Tenant provisioning: new site from template in under a day
5. Shared platform improvements propagate; tenant knowledge does not

**The payoff worth being precise about:** four sites at 10k sessions each provide, for platform-level questions, roughly the statistical power of one site at 40k — but with far better external validity, because an effect that replicates across four independent niches is much more likely to be causal than one that shows up once. That external validity, not the raw sample size, is the thing competitors can't easily buy.

---

## 12. Timeline Summary

| Stage | Weeks | Gated on | Output |
|---|---|---|---|
| 0 — Decisions | 1 | — | Niche, kill criteria, brand rules, rubric |
| 1 — Site alive | 1–3 | — | Deployed site, 5 articles, rollback proven |
| 2 — Data spine | 3–6 | — | All connectors landing daily |
| 3 — Policy Engine | 6–9 | — | CI gate, freeze, auto-rollback |
| 4 — Builder + Operator | 9–14 | Stage 3 | Agents shipping reviewed PRs |
| 5 — Analyst | 14–18 | Stage 2 | Health score, anomalies, decision log |
| 6 — Quality + Strategist | 18–22 | Stage 5 | Refresh queue, weekly roadmap |
| **Rung 1 gate** | — | **1k sessions + 100 pages** | Split-URL testing, Working Beliefs |
| **Rung 2 gate** | — | **10k sessions** | A/B, Principles, full CRO |
| **Tenant 2** | — | Rung 2 + bandwidth | Cross-site validation, the moat |

Weeks 1–22 are under your control. Everything after is under the traffic curve's control, and that curve is set mostly by Stage 0's niche decision and by content quality — not by anything in Stages 2 through 6.

---

## 13. Things That Will Go Wrong

Worth reading before starting rather than discovering individually.

**A connector fails silently and you trust the gap.** Ingest monitoring with row-count assertions from day one. A zero is a value; a missing row is not.

**The quality score drifts upward.** LLM rubric scoring without human anchoring converges on 4s. Re-anchor quarterly against your own scoring.

**Builder fabricates product specifications.** The most likely way this system destroys its own credibility. The fact-check pass with source mapping is not optional, and spot-check it manually forever.

**The first experiment is unreadable.** An algorithm update, a seasonal swing, or a competitor's redesign lands mid-window. Expect roughly a third of early tests to be invalidated by confounders. Budget for re-runs rather than salvaging.

**You relax a threshold "just this once."** This is the failure the entire specification exists to prevent, and it will feel completely reasonable in the moment. Make threshold changes require a commit to `policy/rules.yml` so they're at least visible in the diff and reviewable later.

**Agent costs creep past the site's revenue.** Set a hard monthly budget cap in the Operator's health check, with automatic degradation to cheaper tiers rather than silent overspend.

**You build Stages 2–6 and the niche was wrong.** The kill criteria in Stage 0 exist for this. Honor them.

**Infrastructure work displaces content work.** The parallel content track in every stage is the countermeasure, and it's the one most likely to be quietly dropped. If a stage ends and the article count didn't move, the stage failed regardless of what shipped.

---

## 14. First Two Weeks, Concretely

If you want to start tomorrow:

1. Pick the niche. Model the full page inventory — if it can't reach 100 comparable pages, pick again.
2. Write kill criteria with dates. Commit them.
3. Write `brand/rules.md` and `brand/quality-rubric.md`.
4. Scaffold the repo with the structure in §3.1.
5. Astro site, static, Lighthouse 95+ mobile, schema and sitemap working.
6. Deploy to Vercel. Break it. Roll it back. Write down the procedure.
7. Verify Search Console. Install PostHog.
8. Write three articles yourself. Score them against your own rubric. These are the calibration set.
9. Create the Supabase project and run the Stage 2 foundation migration — even with nothing writing to it yet.
10. Stand up the Search Console connector and backfill.

That's Stage 0 and most of Stage 1, and at the end of it the site is live, collecting data, and publishing — which is the position from which everything else is worth building.
