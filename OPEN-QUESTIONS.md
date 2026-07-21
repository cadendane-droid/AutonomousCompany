# Open Questions

Everything the scaffold could not decide, decided provisionally, or could not
verify. Four sections: what blocks the system entirely, what was decided on your
behalf, what needs checking against reality, and what was deliberately not built.

`grep -rn "TODO(setup)" .` returns the machine-readable version of §1 and §3.

---

## Section 1 — Blocking

These must be answered before the system can run at all. Nothing below is a
technical obstacle; all of it is a decision.

### 1.1 The niche

**Needed because:** it determines the content, the affiliate programs, the brand
voice, the quality rubric's calibration examples, and — critically — whether this
system can ever do the thing it was built for. The split-URL methodology needs
100+ comparable pages. A niche that tops out at 40 meaningful articles can never
reach Rung 1 measurement, and the entire measurement apparatus becomes
decorative.

**Placeholder used:** `PLACEHOLDER_NICHE`, exported from
`packages/core/src/constants.ts`.

**Criteria** are in implementation plan §2.1. The ones most often skipped:
model the full page inventory *before* committing; confirm the affiliate programs
support sub-IDs, or per-page revenue attribution is impossible and the health
score's revenue component is fiction; avoid YMYL entirely.

**Files that change when answered:**
- `packages/core/src/constants.ts` — `PLACEHOLDER_NICHE`
- `brand/rules.md` — voice, prohibited patterns, sourcing standards
- `brand/quality-rubric.md` — calibration examples
- `site/src/layouts/BaseLayout.astro` — `SITE_NAME`
- `site/src/pages/index.astro` — homepage copy
- `site/src/content/tenant-alpha/**` — all three example articles are templates
  with filler prose; replace before launch
- `db` — `tenants.niche`, via `pnpm db:seed --niche`

### 1.2 The tenant slug

**Needed because:** it scopes the content directory, the Astro content
collection, and every `tenant_id` lookup.

**Placeholder used:** `tenant-alpha`.

**Files that change:** `packages/core/src/constants.ts`
(`DEFAULT_TENANT_SLUG`), the `site/src/content/tenant-alpha/` directory name,
the collection key in `site/src/content/config.ts`, and the `tenants.slug` row.

A note on changing it later: this is the cheapest of the four to defer, because
`scripts/tenant-create.ts` provisions a new tenant cleanly. It is the most
annoying to change *in place*, because the content directory has to move.

### 1.3 The domain

**Needed because:** canonical URLs, the sitemap, JSON-LD, Search Console
property verification, and the Vercel domain attachment all derive from it.

**Placeholder used:** `example-tenant.com`.

**Files that change:** `packages/core/src/constants.ts`
(`DEFAULT_TENANT_DOMAIN`), `SITE_BASE_URL` and `GSC_SITE_URL` in `.env` and in
GitHub secrets, `tenants.domain`. `site/astro.config.mjs` reads `SITE_BASE_URL`
and needs no edit.

### 1.4 The affiliate program

**Needed because:** without per-page attribution via sub-IDs, no revenue can ever
be tied to a page, which makes every page-level revenue decision unsupportable.
Know this before your first CRO test, not during it.

**Placeholder used:** `PLACEHOLDER_PROGRAM`, with a CSV-import reference
implementation of the `AffiliateProvider` interface, since programs vary wildly
and none is chosen.

**Files that change:** `packages/core/src/constants.ts`,
`site/src/components/AffiliateLink.astro` (the `SUBID_PARAM` map — each program
uses a different query parameter), `ingest/src/affiliate/index.ts` (a real
provider alongside the CSV one), `ingest/src/runner.ts`, `brand/disclosure.md`.

### 1.5 Credentials

None exist. `.env.example` documents all 16 variables with where to obtain each.
[SETUP.md](SETUP.md) walks them in dependency order. The system builds, tests,
typechecks, and runs the Policy Engine's deterministic checks with none of them.

---

## Section 2 — Decisions I made for you

Judgment calls, with reasoning and reversal cost. This is where a scaffold
usually hides its assumptions.

**A note on provenance.** The previous session left no `OPEN-QUESTIONS.md`, so
its Section 2 reasoning does not survive. Entries below marked *(inherited)*
are choices it made that I verified and kept rather than made myself — the
reasoning is reconstructed from the code, not recorded by its author. Entries
marked *(this session)* are mine.

### 2.1 Article URLs are flat, not nested under their type *(this session)*

Implementation plan §3.1 puts content in `guides/`, `reviews/`, `comparisons/`
and also requires a `slug` field in frontmatter. Astro reserves `slug` in
collection schemas — it reads that field to override the generated slug, and a
schema declaring it is a hard build error.

**Decided:** keep `slug` in frontmatter (the spec, the Policy Engine's
frontmatter check, and the Builder agent all require it) and omit it from the
Astro collection schema only. Astro then consumes it as the canonical slug, so
articles live at `/how-to-choose-x` rather than `/guides/how-to-choose-x`.
Section listings are still at `/guides`, `/reviews`, `/comparisons`.

**Why this way:** flat URLs are marginally better for SEO and keep the directory
layout a content-authoring concern rather than a URL commitment you cannot
change later without redirects. See `site/src/content/config.ts`.

**To reverse:** delete the `slug` field from frontmatter entirely and let Astro
generate nested slugs from paths. That means removing it from
`FrontmatterSchema`, the policy check's required fields, and the Builder's
emitted frontmatter — a spec deviation, so it should be a deliberate decision.

### 2.2 The Lighthouse check ships disabled *(this session)*

Plan §5.3 requires a Lighthouse regression check. Implemented in
`policy/src/checks/lighthouse.ts`, but `technical.require_lighthouse` is
`false` in `policy/rules.yml`.

**Why:** there is no Vercel preview environment yet, so no score can be
supplied. A fail-closed check on a measurement that can never arrive would block
every site PR from day one, and the realistic response to that is disabling the
check in anger rather than wiring the measurement.

**This is not an override mechanism.** `policy/rules.yml` is a protected path;
flipping the flag requires human approval through GitHub review. And when it is
`true`, a missing score is a hard failure. When it is `false`, the check reports
`not-applicable` with the reason — it never reports a pass it did not earn.

**To reverse:** SETUP.md step 11, one line.

### 2.3 Brand-voice conformance is inside the quality check *(inherited)*

Plan §5.3 lists "Quality score" and "Brand voice conformance" as two rows. The
previous session implemented both in one check
(`policy/src/checks/quality-threshold.ts`), which scores the rubric and returns
`brand_voice_violations` from the same model call.

**Kept because:** it halves the model calls per content PR and both need the
same context loaded. Violations are reported individually in the report, so
nothing is lost in the output. Splitting them would be a defensible preference,
not a correctness fix, and consistency across the repo beats it.

**To reverse:** extract a `brand-voice.ts` check and register it in
`ALL_CHECKS`. Straightforward; costs one extra model call per PR.

### 2.4 Operator runs while the system is frozen *(this session)*

`agents/src/roles/index.ts` exports `ROLES_ALLOWED_WHILE_FROZEN = ['operator']`.
Every other role's jobs are deferred back to the queue while frozen.

**Why:** spec §12 freezes experiments and non-critical deployments, but a
system that stops observing itself while frozen cannot tell you when it is safe
to resume. Operator is monitoring, not change.

**To reverse:** empty the array. The worker then defers everything, and freezes
must be diagnosed entirely by hand.

### 2.5 Deferred jobs go through `fail()`, not a distinct status *(this session)*

A job deferred because the tenant is frozen is recorded via `fail()` with the
reason, which applies backoff and keeps it in the queue.

**Why:** it reuses the existing retry machinery and keeps the job visible.
**The cost is real and worth naming:** it consumes an attempt, so a long freeze
can exhaust `max_attempts` and mark legitimate work `dead`. A `deferred` status
that does not increment attempts would be better.

**To reverse:** add `deferred` to `JobStatusSchema`, a `defer()` in
`packages/db/src/queue.ts` that sets `run_after` without touching `attempts`,
and have `claim` pick those up again. Roughly an hour, and it should probably be
done before the first real freeze.

### 2.6 The worker exits rather than looping forever *(this session)*

`drain()` runs passes until one claims nothing, then exits. Invoked from cron
four times a day.

**Why:** a long-lived process needs supervision, restart policy, and health
checks that a cron-triggered exit does not. At dozens of jobs per day, four
drains is ample, and it keeps agent activity in predictable, reviewable windows.

**To reverse:** wrap `runPass` in a sleep loop. Only worth it if job latency
becomes a real complaint.

### 2.7 No `author` person in Article JSON-LD *(this session)*

`site/src/lib/schema.ts` sets `author` to the publishing Organization, never a
named person.

**Why:** the site discloses AI involvement in content production (spec §13).
Inventing a human byline for schema markup would directly contradict that
disclosure, and fabricated bylines are a trust failure with no rollback.

**To reverse:** when real named humans write or substantively edit articles, add
a `byline` frontmatter field and emit a `Person`. Do it only when it is true.

### 2.8 Product schema emits no `offers` block *(this session)*

**Why:** prices and availability change constantly. Stale price markup is both a
trust failure and a rich-result penalty, and nothing in this system tracks live
merchant prices. Prices belong on the merchant's page.

**To reverse:** requires a price-tracking data source first. Do not reverse it
without one.

### 2.9 Migrations are forward-only, with reversal documented not coded *(inherited)*

Each migration carries a comment describing its manual reversal. There is no
`down` migration.

**Kept because:** forward-only avoids a class of half-reverted schema states,
and the plan explicitly permits "individually reversible in documentation if not
in code". On a system whose central asset is accumulated history, an automated
down-migration is a loaded gun.

### 2.10 Root `package.json` gained runtime dependencies *(this session)*

The scripts in `scripts/` run from the workspace root and import `@atlas/core`,
`@atlas/db`, `@atlas/llm`, `yaml`, and `zod`. Those are now root `dependencies`
rather than `devDependencies`.

**Why:** the eight `pnpm` scripts the previous session declared in
`package.json` had no resolvable imports — every one of them was broken. Adding
a `scripts/` workspace package would have been tidier but changes how every
documented command is invoked.

### 2.11 `scripts/` is typechecked via a root `tsconfig.json` *(this session)*

`pnpm typecheck` was `pnpm -r typecheck`, which only visits workspace packages —
`scripts/` was silently unchecked. It is now `tsc -p tsconfig.json && pnpm -r
typecheck`.

### 2.12 `@astrojs/sitemap` is pinned exactly *(this session)*

Pinned to `3.2.1`. The floating range resolved to 3.7.3, which crashes at
`astro:build:done` against Astro 4 (`Cannot read properties of undefined
(reading 'reduce')`).

**To reverse:** unpin when moving to Astro 5.

### 2.13 ESLint allows destructure-to-omit *(this session)*

`no-unused-vars` now sets `varsIgnorePattern: '^_'` and `ignoreRestSiblings:
true`. The previous session's `rungs.test.ts` used `const { atlas: _atlas,
...rest }` to build an invalid fixture, which the old config rejected — `pnpm
lint` was failing on a clean checkout. Fixing the config rather than the test
preserves the test's evident intent.

---

## Section 3 — Needs verification

Tier B code written against documented API shapes, and anything I could not
test. Everything here compiles and reads correctly; none of it has met a live
service.

### 3.1 Anthropic model identifiers and pricing — verify first

`packages/llm/src/models.ts` uses `claude-haiku-4-5`, `claude-sonnet-5`, and
`claude-opus-4-8`, with per-MTok pricing.

Model ids and prices change. **The pricing figures drive `agent_runs.cost_usd`,
which drives the budget cap and the monthly cost review** — if they are wrong,
the cap is wrong and the router's value is unmeasurable. Verify against
<https://docs.anthropic.com/en/docs/about-claude/models> before relying on any
cost figure. One file, one place to change.

Also note: the `local` tier has no local model provisioned and routes to the
cheapest cloud model. At this volume that costs less than operating local
inference. Revisit if volume grows.

### 3.2 Every database query

All of `packages/db` is Tier B. The SQL is written against the migrations in
this repo and typed end to end, but **no query in this repository has been
executed against a real Postgres.** Column names were transcribed from plan
§4.1/§6.1/§7.3/§9.1 and spot-verified against the migrations, but a typo would
only surface at runtime.

First real test: `pnpm db:migrate && pnpm db:seed && pnpm content:validate`.

### 3.3 Search Console connector

Service-account auth, pagination, the 2–3 day lag, and 16-month backfill are all
implemented from documented behavior. The step most likely to bite: the service
account must be added as a **user on the Search Console property**, not just
granted API access in GCP. Without it the API returns empty results rather than
an error — which looks exactly like a site with no traffic.

### 3.4 PostHog aggregation

`ingest/src/posthog/index.ts` carries `TODO(setup)` markers on the event
property names it aggregates. These depend on how the snippet is configured and
almost certainly need adjusting once real events arrive. Session-level metrics
are derived rather than read from a session table.

### 3.5 Vercel API shapes

Speed Insights ingest and the Operator's deploy-target check are written against
the documented v9/v10 endpoints. Vercel's API moves; verify the response shape
when first run.

### 3.6 The GitHub reviews logic

`scripts/policy-state.ts` derives `human_approved` from an APPROVED review, on
the current head SHA, from an account whose `author_association` is OWNER,
MEMBER, or COLLABORATOR.

**This is the single most security-relevant piece of logic in the repository** —
it is what stops an agent from approving its own work. It fails closed on an
unreadable API. It has not been exercised against a real pull request. Test it
deliberately: open a PR, confirm the state JSON says `false`, approve, confirm
it says `true`, push a commit, confirm it returns to `false`.

### 3.7 The worker against a real Postgres

The worker loop has 7 unit tests with the data layer mocked, covering freeze
behavior, unroutable jobs, handler failures, and unknown tenants. The prompt's
done-condition — "demonstrably processes a seeded job end to end against a local
Postgres" — **has not been met**, because no Postgres was available. The
end-to-end path is step 10 of SETUP.md.

### 3.8 Lighthouse 95+ mobile

The site is built for it: static output, no webfonts, no above-fold async
loading, no layout-shifting elements. **It has not been measured.** Plan §3.2
requires 95+ before the first article ships.

---

## Section 4 — Deliberately deferred

Not built, on purpose, with the stage or rung each belongs to.

| Not built | Belongs to | Note |
|---|---|---|
| Experiment execution, A/B assignment, split-URL running | Rung 1–2 | Tables exist (migration 0010) and are unused. Gated on traffic, not effort. |
| Analyst handlers — health snapshot, anomaly sweep, investigation | Stage 5 | Tier C. The statistics they call are already built and tested in `packages/stats`; what is missing is wiring. |
| Scout handlers — competitor, keyword, reputation scans | Stage 5–6 | Tier C. Competitor scanning needs a registry that does not exist. |
| Strategist handlers — roadmap, weekly review | Stage 6 | Tier C. Also needs a `roadmaps` table, deliberately not in migrations 0001–0013. |
| Working Belief and Principle promotion workflows | Rung 1 / Rung 2 | The `knowledge` table has the tier column; promotion must be an explicit human act, never automatic — an automatic promoter will, given enough runs, promote noise. |
| Automated rollback monitor | Stage 3 remainder | Vercel rollback is manual and documented in the runbook. Only appropriate for fast-signal metrics; a system that auto-reverts on ranking noise thrashes. |
| Dashboard | — | Postgres views in migration 0013 and nothing else. Explicitly not a React app. |
| The 17-agent hierarchy | — | Never. Five roles, per spec §9. |
| Any Policy Engine override | — | Never, by design. |
| Comparison-table component, calculators, newsletter | Rung 1–2 | Plan §3.2 defers these explicitly. |
| MDX content and in-content components | When needed | `AffiliateLink.astro` exists but is not yet reachable from `.md` content, which cannot use components. Enabling MDX is a small change; the Builder currently emits `.md`. |
| Second-tenant features — cross-tenant validation, config extraction | Stage 11 | The *data model* is multi-tenant now ([ADR 0005](docs/adr/0005-multi-tenant-from-day-one.md)); the features are not. |
| Local LLM inference | If volume justifies | The `local` router tier routes to the cheapest cloud model. |
| `down` migrations | — | Forward-only by design; reversal documented per migration. |
