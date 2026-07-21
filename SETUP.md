# Setup

From a fresh clone to a running system, in dependency order. Assumes no prior
knowledge of the project.

Steps 1–2 need nothing but Node. Everything after needs accounts. **Step 0 is
not optional and is not a technical step** — most of what follows depends on
decisions that have not been made yet.

---

## Step 0 — Decide the things the code cannot decide

The repository is scaffolded with placeholders. Before it can run as anything
other than a demo, four decisions must be made and written down. They are listed
in full, with the files each one changes, in
[OPEN-QUESTIONS.md §1](OPEN-QUESTIONS.md).

| Decision | Placeholder in the code |
|---|---|
| The niche | `PLACEHOLDER_NICHE` |
| The tenant slug | `tenant-alpha` |
| The domain | `example-tenant.com` |
| The affiliate program | `PLACEHOLDER_PROGRAM` |

The niche is the highest-leverage decision in the project and no amount of
system quality compensates for getting it wrong. Criteria are in implementation
plan §2.1. The one that most often gets skipped: **model the full page inventory
before committing.** A niche that tops out at 40 meaningful articles can never
reach the 100+ comparable pages that Rung 1 measurement requires, which means
this system can never do the thing it was built to do.

Also write down kill criteria with dates (plan §2.2), now, while you are
unbiased. At month 6 you will have sunk cost and will rationalize.

---

## Step 1 — Local build

Requires Node 20+ and pnpm 9.

```bash
corepack enable
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

All five should pass with no credentials and no database. If they do not, stop
here — everything downstream assumes a green build.

---

## Step 2 — Environment file

```bash
cp .env.example .env
```

Leave it empty for now. Each section below tells you which variables it fills.
Every variable used anywhere in the repo is documented in `.env.example`, and
code reads it through `requireEnv()`, which fails naming the missing variable
rather than surfacing `undefined` three layers down.

`.env` is gitignored. Never commit it.

---

## Step 3 — Supabase (database)

1. Create a project at <https://supabase.com/dashboard>. Choose a region near
   your users. The Pro plan (~$25/mo) is what the cost model assumes; the free
   tier works to start but pauses on inactivity.
2. **Project Settings → Database → Connection string → URI (session mode).**
   Copy it into `DATABASE_URL` in `.env`, replacing `[YOUR-PASSWORD]`.
3. Copy the project ref (the subdomain in the connection string) into
   `SUPABASE_PROJECT_REF`.
4. Apply the schema:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

   `db:migrate` applies migrations 0001–0013 and records them in
   `schema_migrations`. `db:seed` creates the tenant and its `system_state` row,
   and is idempotent.

5. Verify:

   ```bash
   psql "$DATABASE_URL" -c "select slug, domain, rung from tenants"
   ```

   You should see one tenant at rung 0.

Migration 0001 enables `pgvector` and `pgcrypto`. Both are available on Supabase
by default; if the migration fails on extensions, enable them under
**Database → Extensions** and re-run.

---

## Step 4 — Anthropic API

1. Create a key at <https://console.anthropic.com/settings/keys>.
2. Put it in `ANTHROPIC_API_KEY`.
3. Set `ATLAS_LLM_MONTHLY_BUDGET_USD` to a number you are actually willing to
   spend. The router degrades to cheaper models as spend approaches the cap and
   hard-stops at it — that is a feature, and a stalled queue at month end means
   it worked.

Model identifiers live in exactly one place: `packages/llm/src/models.ts`.
**Verify them before you rely on cost figures** — see
[OPEN-QUESTIONS.md §3](OPEN-QUESTIONS.md).

---

## Step 5 — The site, and Vercel

1. Build it locally first:

   ```bash
   pnpm --filter @atlas/site build
   ```

   Output lands in `site/dist/`. Three example articles are included as format
   templates; their prose is filler and must be replaced before launch.

2. Buy the domain. Put it in `SITE_BASE_URL` (`https://…`, no trailing slash).

3. Create a Vercel project pointed at this repository:
   - **Framework preset:** Astro
   - **Root directory:** `site`
   - **Build command:** `pnpm --filter @atlas/site build`
   - **Output directory:** `dist`
   - Add `SITE_BASE_URL` as a Vercel environment variable too — the Astro config
     reads it at build time for canonical URLs and the sitemap.

4. Attach the domain in **Project → Settings → Domains**.

5. Create a token at <https://vercel.com/account/tokens>. Fill `VERCEL_TOKEN`,
   `VERCEL_PROJECT_ID` (Project Settings → General), and `VERCEL_TEAM_ID` (blank
   on a personal account).

6. **Break production and roll it back. Time it. Write down what you did.**

   This is not optional and it is not ceremony. Law 2 depends on this mechanism,
   and an autonomous system is about to rely on it. Push something visibly
   broken, promote the previous deployment from the Vercel dashboard, confirm the
   site recovers. The procedure is in
   [docs/runbook.md](docs/runbook.md#roll-back-a-deploy) — correct it there if
   reality differs.

---

## Step 6 — Google Search Console

This is the most fiddly step. Search Console retains only 16 months of data, so
**every day this is not running is a day of history permanently lost.** Do it
early even though nothing analyzes the data for months.

1. Verify the property at <https://search.google.com/search-console>. Prefer a
   domain property (DNS verification) over a URL-prefix property.
2. Create a Google Cloud project and enable the **Search Console API**.
3. Create a service account, then a JSON key for it.
4. In Search Console: **Settings → Users and permissions → Add user** — add the
   service account's email address with **Full** permission. This step is the one
   people miss; the API returns empty results rather than an error without it.
5. Fill in `.env`:
   - `GSC_CLIENT_EMAIL` — the service account email
   - `GSC_PRIVATE_KEY` — the `private_key` field from the JSON, newlines as
     literal `\n`
   - `GSC_SITE_URL` — `sc-domain:yourdomain.com` for a domain property, or the
     full URL prefix
6. Backfill everything available, immediately:

   ```bash
   pnpm ingest:run --connector search-console --backfill
   ```

---

## Step 7 — PostHog

1. Create a project at <https://us.posthog.com>.
2. Two different keys, easily confused:
   - `POSTHOG_PROJECT_API_KEY` — starts `phc_`, **public**, goes in the site
     snippet.
   - `POSTHOG_PERSONAL_API_KEY` — starts `phx_`, **secret**, used by the ingest
     connector for HogQL queries.
3. Also set `POSTHOG_PROJECT_ID` and `POSTHOG_HOST`.
4. Add the snippet to the site. There is a marked `TODO(setup)` for it in
   `site/src/layouts/BaseLayout.astro`.
5. Enable session replay and heatmaps now, even though nobody looks at them until
   Rung 1. The recordings are only useful if they exist.

---

## Step 8 — GitHub secrets

The workflows read these. **Settings → Secrets and variables → Actions.**

Secrets:

| Secret | From |
|---|---|
| `DATABASE_URL` | Step 3 |
| `SUPABASE_PROJECT_REF` | Step 3 |
| `ANTHROPIC_API_KEY` | Step 4 |
| `SITE_BASE_URL` | Step 5 |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Step 5 |
| `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`, `GSC_SITE_URL` | Step 6 |
| `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY` | Step 7 |
| `ATLAS_PR_TOKEN` | Optional. A fine-grained PAT with `contents:write` + `pull_requests:write`. Needed only if you want agent PRs to trigger other workflows, which the built-in `GITHUB_TOKEN` deliberately does not do. |

Variables (not secret):

| Variable | Value |
|---|---|
| `ATLAS_LLM_MONTHLY_BUDGET_USD` | Your cap |

---

## Step 9 — Branch protection ← the step that makes the Policy Engine real

Until this is configured, the Policy Engine reports failures that nothing
enforces, and an agent can merge anything.

**Settings → Branches → Add branch protection rule** for `main`:

- ☑ **Require status checks to pass before merging**
  - ☑ `Evaluate proposal against policy/rules.yml` (the `policy-check` workflow)
  - ☑ `Lint, typecheck, test, build` (the `ci` workflow)
- ☑ **Require a pull request before merging**
  - ☑ Require approvals: **1**
  - ☑ Dismiss stale approvals when new commits are pushed
- ☑ **Do not allow bypassing the above settings** — including for
  administrators. An exception here is an exception an agent can eventually use.

The "dismiss stale approvals" box matters more than it looks: it is what stops an
approval of an earlier commit from covering a later push.
`scripts/policy-state.ts` also checks the approved commit against the current
head, so this is belt and braces — keep both.

---

## Step 10 — Enable the scheduled workflows

Workflows on `schedule` triggers activate once they are on the default branch.
Confirm under **Actions**, then trigger each manually once to check the secrets
are right:

| Workflow | Schedule | Does |
|---|---|---|
| `Ingest (daily)` | 05:20 UTC daily | All connectors |
| `Health check (Operator)` | 06:40 UTC daily | Freshness, budget, errors, coverage |
| `Agent worker` | 4×/day | Drains the job queue |
| `Lighthouse` | Weekly, Monday | Technical metrics sample |
| `Policy Check` | On every PR | Blocks merges |
| `CI` | On push and PR | Lint, typecheck, test, build |

Sanity-check the health check end to end:

```bash
pnpm queue:enqueue --role operator --kind health-check
pnpm --filter @atlas/agents worker --role operator
```

---

## Step 11 — Enable the Lighthouse policy gate

Once step 5 is done and preview deploys exist, turn on the check that was left
off because it had nothing to measure:

```yaml
# policy/rules.yml
technical:
  require_lighthouse: true
```

That file is a protected path, so this is a reviewed commit — which is the point.

---

## Step 12 — Write three articles yourself

Not a technical step, and the one most likely to be skipped.

Write three articles by hand and score them against `brand/quality-rubric.md`
yourself. They are the calibration set. An LLM rubric without human anchoring
converges on scoring everything a 4, and a broken quality score is worse than
none because it drives the refresh queue.

You also need to know what good looks like in this niche before delegating it.

---

## Verify the whole thing

```bash
pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck
pnpm db:migrate && pnpm db:seed
pnpm content:validate
pnpm ingest:run --connector search-console
pnpm queue:enqueue --role operator --kind health-check
pnpm --filter @atlas/agents worker --role operator
```

If all of that succeeds, the system is running at Rung 0: capturing data,
gating changes, and logging decisions. It will stay there until traffic says
otherwise — which is the design.
