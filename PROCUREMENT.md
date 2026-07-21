# Procurement checklist

What you need to acquire, decide, or produce before Atlas OS can run as a real
system rather than a scaffold.

This is the *what to get* list. [SETUP.md](SETUP.md) is the *how to wire it up*
list, and it assumes you already have everything here. Where the two overlap,
this document explains the acquisition and SETUP.md explains the configuration.

Ordered by dependency: items in each tier depend on the tier above.

---

## Summary — the whole list at a glance

| # | Deliverable | Cost | Lead time | Blocks |
|---|---|---|---|---|
| **D1** | Niche decision | £0 | 1–2 weeks of research | Everything |
| **D2** | Kill criteria with dates | £0 | 1 hour | Nothing, but do it now |
| **D3** | Domain name | ~£10–15/yr | Minutes to buy, hours for DNS | Site, GSC, Vercel |
| **D4** | Tenant slug | £0 | Minutes | Content paths |
| **A1** | GitHub plan + repo visibility decision | £0–4/mo | Minutes | Branch protection |
| **A2** | Supabase project (Pro) | ~$25/mo | Minutes | All data, all agents |
| **A3** | Vercel project (Pro) | ~$20/mo | Minutes | Hosting, previews, rollback |
| **A4** | Anthropic API credits | $30–150/mo | Minutes | All agent work |
| **A5** | PostHog project (Free) | $0 | Minutes | Behaviour metrics |
| **A6** | Google Cloud project | $0 | Minutes | Search Console API |
| **A7** | Affiliate program acceptance | $0 | **Days to weeks** | Revenue, sub-IDs |
| **C1–C9** | Credentials and keys | — | Minutes each | See §3 |
| **H1** | Brand rules for the niche | £0 | Half a day | Policy Engine's voice check |
| **H2** | Quality rubric calibration — 3 hand-written articles | £0 | 2–3 days | Quality scoring, refresh queue |
| **H3** | Disclosure wording review | £0–legal | Days | Compliance |
| **H4** | 5 articles by launch, 15–20 by end of Stage 2 | £0 | Ongoing | Traffic, everything |
| **X1** | Branch protection | £0 | 10 minutes | **The Policy Engine binding at all** |
| **X2** | Proven deploy-and-rollback | £0 | 1 hour | Law 2 being real |

**Running cost once live: roughly $75–195/month**, dominated by LLM spend, which
you control with `ATLAS_LLM_MONTHLY_BUDGET_USD`.

---

## Tier 0 — Decisions (free, blocking, and first)

Nothing below can be bought until these are made. They cost nothing but time,
and they are the highest-leverage items on the list.

### D1 — The niche

**Why it's first:** it determines the domain you buy, the affiliate programs you
apply to, the brand voice, the quality rubric, and — critically — whether this
system can ever do what it was built for.

**The criterion most people skip:** model the full page inventory *before*
committing. The split-URL methodology needs 100+ comparable pages. A niche that
tops out at 40 meaningful articles can never reach Rung 1 measurement, which
makes the entire measurement apparatus decorative. Sit down and list the actual
article titles until you run out of ideas. If you stop before 100, pick again.

**The other hard requirements** (implementation plan §2.1):

- **Affiliate programs with sub-ID support.** Without per-page attribution,
  revenue can never be tied to a page, and the health score's revenue component
  is fiction. Verify this *before* committing, by reading the program's
  documentation — not after.
- **Not YMYL.** Health, finance, and legal face elevated quality thresholds and
  make AI-assisted production substantially riskier. Avoid entirely.
- **Tolerable competition.** If the top 10 for your head terms are all major
  publishers, pick something else.
- **Genuine product churn.** Niches where products update annually create a
  natural refresh cycle and a defensible reason for the site to exist.

**How to research it:** keyword tools for volume, manual SERP inspection for
competition, and the affiliate networks' own program directories (see A7) for
whether the money is actually there. Budget one to two weeks. This is the
decision you are allowed to be slow about.

**Deliverable:** a written decision, committed to the repo, naming the niche and
answering each criterion above.

### D2 — Kill criteria with dates

**Why now:** at month 6 you will have sunk cost and will rationalize. Write these
while you are unbiased. Implementation plan §2.2 gives the checkpoints:

| Checkpoint | Continue if | Otherwise |
|---|---|---|
| Month 3 | 40+ articles indexed, any impressions trend | Re-examine niche or content quality |
| Month 6 | 500+ sessions/month, first affiliate clicks | Niche likely wrong — pivot before building more |
| Month 12 | 3,000+ sessions/month, non-zero revenue | Continue, pivot, or stop |
| Month 18 | Rung 1 measurement running | Reassess whether the OS thesis holds |

**Deliverable:** a committed Markdown file with real calendar dates in it.

### D3 — The domain

**Depends on:** D1.

**Cost:** ~£10–15/year for a `.com` at any mainstream registrar (Cloudflare
Registrar sells at cost and is the cheapest sane option; Namecheap and Porkbun
are fine).

**A decision worth making deliberately:** a *brand new* domain has no Search
Console history, so the 16-month backfill in SETUP.md step 6 will return
nothing. That is expected and fine — but be aware the backfill only pays off if
you buy a domain with existing traffic history. Buying an aged domain is a
specialist activity with real risk (prior penalties, spam history) and I would
not recommend it unless you already know how to audit one.

**Practical advice:** pick something brandable rather than exact-match keyword.
Exact-match domains read as affiliate spam and constrain you if the niche
evolves. You will be typing this for years.

**Deliverable:** a registered domain with DNS you control.

### D4 — The tenant slug

**Depends on:** D1. **Cost:** none. Takes a minute.

A short kebab-case identifier for the site, e.g. `alpine-gear`. It scopes the
content directory and every database row.

This is the cheapest of the four to change later *if* you use
`pnpm tenant:create` to make a new one, and the most annoying to change in place,
because the content directory has to move. Pick one you can live with.

---

## Tier 1 — Accounts and subscriptions

### A1 — GitHub: decide visibility, then confirm plan

**Current state, which you should decide deliberately:** the repository is
**public**, under a personal account, and `main` has **no branch protection**.

Two consequences:

1. **Public means the entire system is readable by anyone**, including whichever
   niche you choose, your brand rules, your policy thresholds, and every agent
   proposal. The moat this project is built around is accumulated *evidence* in
   a private database — the code being public does not leak that. But your
   strategy is visible. Decide whether that is intentional.
2. **Branch protection is free on public repositories.** If you switch to
   private, verify that branch protection or rulesets are available on your plan
   before you do — GitHub has historically gated some protection features on
   private repos behind paid plans, and **branch protection is the single thing
   that makes the Policy Engine binding** (ADR 0004). Do not switch to private
   and discover afterwards that you cannot protect `main`.

**Cost:** £0 public. GitHub Pro is ~$4/month if you go private and need it.

**Deliverable:** a conscious decision on visibility, and confirmation that you
can set branch protection under it.

### A2 — Supabase project

**Cost:** Free tier works to start; **Pro at ~$25/month is what you actually
need.** The reason is specific: the free tier pauses projects after about a week
of inactivity, and this system runs daily cron jobs against the database. A
paused database means silent ingest failures, which is precisely the failure
mode the whole ingest-monitoring design exists to prevent.

**How:** create a project at <https://supabase.com/dashboard>, region near your
users. Migration 0001 needs `pgvector` and `pgcrypto`; both are available by
default, and if the migration complains, enable them under **Database →
Extensions**.

**Deliverable:** a running Postgres with a connection string, and the project ref.

### A3 — Vercel project

**Cost:** the Hobby tier is free but its terms **prohibit commercial use**, and
an affiliate site is commercial. Budget **Pro at ~$20/month**. Verify the
current terms yourself rather than taking my word for it — but do not build a
revenue-generating site on Hobby and hope.

**What you get that the architecture depends on:** preview deploys per pull
request (which the Lighthouse policy check measures against), instant rollback
to a prior deployment (which is the mechanism Law 2 relies on), and Speed
Insights for field Core Web Vitals.

**Deliverable:** a project connected to the repo with root directory `site`, the
domain attached, and a working preview deploy.

### A4 — Anthropic API credits

**Cost:** $30–150/month depending on content volume and how disciplined the
router is. Pay-as-you-go — you add credits to a balance rather than subscribing.

**How:** <https://console.anthropic.com>. Add a payment method and an initial
credit balance. Start small; the budget cap in this repo hard-stops spend, so
the risk of a runaway bill is low, but the risk of a stalled queue at month end
is real. $50 to start is sensible.

**Before you rely on cost figures:** verify the model identifiers and per-token
pricing in `packages/llm/src/models.ts` against
<https://docs.anthropic.com/en/docs/about-claude/models>. Those numbers drive
`agent_runs.cost_usd`, which drives the budget cap and the monthly cost review.
If they are wrong, your cap is wrong. This is OPEN-QUESTIONS §3.1 and it is the
single most likely thing in the repo to be stale.

**Deliverable:** an API key and a funded balance.

### A5 — PostHog project

**Cost:** $0. The free tier includes roughly 1M events/month, which is
enormously more than a Rung 0 site generates. **Do not pay for this early.**

**How:** <https://us.posthog.com>. Create a project.

**Do this early even though nothing reads it for months:** enable session replay
and heatmaps now. The recordings are only useful if they exist, and you cannot
retroactively record sessions from last quarter.

**Deliverable:** a project, its ID, the public project key, and a personal API
key.

### A6 — Google Cloud project (for the Search Console API)

**Cost:** $0. Search Console API usage is free at this scale.

**How:** create a project at <https://console.cloud.google.com>, enable the
**Search Console API**, create a service account, and generate a JSON key.

**The step that catches everyone:** the service account must additionally be
added as a **user on the Search Console property itself** (Settings → Users and
permissions → Add user, Full permission). Granting API access in GCP is not
enough. Without this, the API returns *empty results rather than an error* —
which looks exactly like a site with no traffic, and you will debug it for an
afternoon.

**Deliverable:** a service account email, its private key, and property access.

### A7 — Affiliate program acceptance ← the long pole

**Depends on:** D1, D3, and realistically H4 (some published content).

**This is the only item with a lead time measured in weeks, and it has a
chicken-and-egg problem worth planning around:** most affiliate programs review
applications manually and **reject sites with no content and no traffic**. You
cannot apply on day one and you should not try.

**Sequence that actually works:**

1. During D1, verify programs *exist* for the niche and that they support
   sub-IDs. Read their docs. Do not apply yet.
2. Publish 10–15 genuinely good articles (part of H4).
3. Then apply. Approval typically takes days to a couple of weeks.
4. Until approved, `PLACEHOLDER_PROGRAM` and the CSV-import provider stand in,
   and `affiliate_metrics` stays empty. That is fine — at Rung 0 there is no
   revenue signal to lose.

**Where to look:** the large networks (Amazon Associates, Awin, CJ, Impact,
ShareASale, Rakuten) plus direct in-house programs, which often pay better and
are more willing to talk to a small site.

**Non-negotiable acceptance criterion: sub-ID support.** If a program cannot
attribute a conversion to the specific page that produced the click, that
program's revenue can never inform any page-level decision. Know this before you
integrate, not during your first CRO test.

**Deliverable:** at least one approved program, its sub-ID parameter name, and
its reporting mechanism (API or CSV export).

---

## Tier 2 — Credentials to generate

All derived from Tier 1. Each maps to a variable in `.env.example` and a GitHub
Actions secret. None costs money.

| ID | Credential | From | Env var |
|---|---|---|---|
| C1 | Postgres connection string | A2 | `DATABASE_URL` |
| C2 | Supabase project ref | A2 | `SUPABASE_PROJECT_REF` |
| C3 | Anthropic API key | A4 | `ANTHROPIC_API_KEY` |
| C4 | GitHub fine-grained PAT (`contents:write`, `pull_requests:write`) | A1 | `GITHUB_TOKEN` / `ATLAS_PR_TOKEN` |
| C5 | GSC service account email + private key | A6 | `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY` |
| C6 | GSC property URL | A6 + D3 | `GSC_SITE_URL` |
| C7 | PostHog project key (public) + personal key (secret) + project ID | A5 | `POSTHOG_PROJECT_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` |
| C8 | Vercel token, project ID, team ID | A3 | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` |
| C9 | Site origin | D3 | `SITE_BASE_URL` |

**Two PostHog keys are easily confused and it matters:** the project key starts
`phc_`, is public, and goes in the browser snippet. The personal key starts
`phx_`, is secret, and is used server-side by the ingest connector. Putting the
personal key in the snippet leaks it to every visitor.

**Where they go:** `.env` locally (gitignored, never committed), and GitHub
**Settings → Secrets and variables → Actions** for the workflows. SETUP.md step
8 has the full mapping. `ATLAS_LLM_MONTHLY_BUDGET_USD` goes in *Variables*, not
Secrets — it is not sensitive.

---

## Tier 3 — Things only a human can produce

No amount of scaffolding substitutes for these, and they are the ones most
likely to be quietly skipped.

### H1 — Brand rules for the chosen niche

**Depends on:** D1. **Effort:** half a day.

`brand/rules.md` currently contains generic placeholder guidance marked
`TODO(setup)`. Rewrite it for the actual niche: voice, prohibited patterns,
factual sourcing standards, and the protected-page list.

**This is not decorative.** The Policy Engine's brand-voice check loads this file
and evaluates content against it. Vague rules produce vague enforcement.

### H2 — Quality rubric calibration: three articles you write yourself

**Depends on:** D1. **Effort:** two to three days. **Skipped by almost everyone.**

Write three articles by hand — genuinely, not by editing AI output — and score
them yourself against the five rubric dimensions. They become the calibration
anchors in `brand/quality-rubric.md`.

**Why it cannot be skipped:** an unanchored LLM rubric converges on scoring
everything a 4. The quality score drives the refresh queue, so a broken score
does not merely produce bad numbers, it misprioritizes every refresh decision
the system makes for the next year. A broken quality score is worse than none.

The secondary benefit is larger than the primary one: you will not know what good
looks like in this niche until you have tried to produce it, and you cannot
delegate a standard you have not personally met.

### H3 — Disclosure wording review

**Depends on:** A7. **Cost:** free to review yourself; a lawyer if you want
certainty.

`brand/disclosure.md` and `site/src/components/AffiliateDisclosure.astro` carry
wording that must satisfy the affiliate program's terms and your jurisdiction's
advertising rules (FTC in the US, CAP/ASA in the UK). Most programs specify
required disclosure language contractually.

The component is a protected path, so changes need human approval — by design.

### H4 — Content, continuously

**The parallel track that every stage requires and that is most likely to be
dropped.** Implementation plan §0 is blunt about this: if a stage ends and the
article count did not move, the stage failed regardless of what shipped.

| Milestone | Target |
|---|---|
| Launch | 5 articles |
| End of Stage 2 (~week 6) | 15–20, clustered tightly around one or two topics |
| End of Stage 4 (~week 14) | 40+, an increasing share Builder-drafted and human-edited |

Topical density beats breadth early. Track your **edit ratio** — the fraction of
Builder output you substantially rewrite. That number falling is the real signal
the content pipeline works, and it is far more informative than any quality
score the system gives itself.

---

## Tier 4 — Configuration acts that are not purchases

Free, fast, and two of them are load-bearing enough to list as deliverables.

### X1 — Branch protection on `main` ← do this one first

**Currently not configured.** Until it is, the Policy Engine reports failures
that nothing enforces, and anything can be merged. This is the single most
important configuration step in the repository and it costs ten minutes.

**Settings → Branches → Add branch protection rule** for `main`:

- Require status checks to pass: `Evaluate proposal against policy/rules.yml`
  and `Lint, typecheck, test, build`
- Require a pull request before merging, 1 approval
- **Dismiss stale approvals when new commits are pushed** — this is what stops
  an approval of an earlier commit from covering a later push
- **Do not allow bypassing, including for administrators.** An exception here is
  an exception an agent can eventually use.

You can do this today, before any other procurement, and you should.

### X2 — Proven deploy-and-rollback

**Depends on:** A3, D3.

Deliberately break production, roll it back from the Vercel dashboard, time it,
and write down what you actually did. Correct
[docs/runbook.md](docs/runbook.md#roll-back-a-deploy) where reality differs.

This is not ceremony. Law 2 depends on this mechanism and an autonomous system is
about to rely on it. Knowing it works — and how long it takes — before you need
it at 2am is the entire point.

### X3 — Enable the Lighthouse policy gate

**Depends on:** A3, X2.

Once preview deploys exist, flip `technical.require_lighthouse` to `true` in
`policy/rules.yml`. It ships disabled because there was no preview environment to
measure and a fail-closed check on an unobtainable measurement would block every
site PR. That file is a protected path, so this is a reviewed commit — which is
the point.

---

## Cost summary

| Item | Monthly | Annual |
|---|---|---|
| Supabase Pro | ~$25 | ~$300 |
| Vercel Pro | ~$20 | ~$240 |
| Anthropic API | $30–150 | $360–1,800 |
| PostHog | $0 (free tier) | $0 |
| Google Cloud | $0 | $0 |
| GitHub | $0 public | $0 |
| Domain | — | ~$15 |
| **Total** | **~$75–195** | **~$915–2,355** |

Verify all prices at purchase — these are the implementation plan's estimates
and vendor pricing moves.

LLM spend is the variable you control, via `ATLAS_LLM_MONTHLY_BUDGET_USD`. The
router degrades to cheaper models as the cap approaches and hard-stops at it. A
stalled queue at month end means the cap worked.

---

## Suggested order of operations

The dependency graph, flattened into something you can work through.

**This week — free, unblocks everything:**

1. **X1 — branch protection.** Ten minutes, no dependencies, makes the Policy
   Engine real.
2. **A1 —** decide repo visibility deliberately.
3. **D2 —** write kill criteria with dates.
4. Start **D1** — niche research.

**Weeks 1–2:**

5. Finish **D1**, including modelling the full page inventory to 100+ pages.
6. **D4 —** tenant slug. **D3 —** buy the domain.
7. **A2, A4, A5 —** Supabase, Anthropic, PostHog. Run `pnpm db:migrate` and
   `pnpm db:seed`; this is also the first real test of every Tier B query in
   `packages/db`.

**Weeks 2–3:**

8. **A3 —** Vercel, domain attached, site deployed.
9. **X2 —** break it, roll it back, write down the procedure.
10. **A6 —** Google Cloud, service account, Search Console verification. Do this
    as early as possible: every day it is not running is a day of history you
    cannot recover.
11. **H1 —** rewrite brand rules for the niche.
12. **X3 —** enable the Lighthouse gate.

**Weeks 3–6:**

13. **H2 —** write and score three articles by hand.
14. **H4 —** keep publishing toward 15–20.
15. **A7 —** apply to affiliate programs once you have 10–15 articles. Expect to
    wait.

**Then:** the system is at Rung 0, capturing data, gating changes, and logging
decisions. It stays there until traffic says otherwise — which is the design, not
a limitation.

---

## What is deliberately *not* on this list

- **Analytics dashboard software.** Postgres views only. No React app, no
  Metabase, no Looker. Resist.
- **A message broker or Redis.** [ADR 0003](docs/adr/0003-postgres-queue-over-redis.md).
- **Experiment tooling.** PostHog experiments are wired at Rung 2, not now.
  There is no traffic to power them and buying tooling early creates pressure to
  use it.
- **SEO suites (Ahrefs, Semrush).** Genuinely useful for D1 niche research, and a
  month's subscription during research is defensible. Not required by the system,
  and not a recurring cost you need at Rung 0.
- **A second tenant.** Gated on the first reaching Rung 2 *and* your having
  bandwidth. Two mediocre sites is worse than one good one.
