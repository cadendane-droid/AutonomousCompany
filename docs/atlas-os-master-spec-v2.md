# Atlas OS

**Autonomous Publishing Operating System**
Master Specification — Version 2.0

*Supersedes: Atlas OS v1.0 Design Specification and Atlas OS Technical Architecture*

---

## 0. What Changed From v1.0

Version 1.0 described a mature system. It did not describe how to get there. The core revision in v2.0 is that **operational rigor is gated on traffic volume**, because the statistical machinery in v1.0 cannot function below roughly 10,000 sessions per month and produces false confidence if run anyway.

| Area | v1.0 | v2.0 |
|---|---|---|
| Experimentation | Universal, mandatory from day one | Phase-gated; below threshold, changes are logged not tested |
| SEO testing | Same A/B pipeline as everything else | Separate split-URL cohort methodology |
| Knowledge base | Stores "validated principles" with confidence scores | Tiered ladder: Observation → Working Belief → Principle |
| Agent structure | 17 agents, 3 layers | 5 functional roles, flat, expandable |
| Health score | Fixed weights at all stages | Phase-dependent weights |
| Multi-tenancy | "Future scaling" | Built into the data model from day one |
| Policy Engine | "One architectural addition I'd make" | Core, non-optional, first thing built |

Everything else from v1.0 — the vision, the constitution, the analytics taxonomy, the event-driven architecture, the AI router, the memory layers — is retained, in most cases unchanged.

---

## 1. Vision

Atlas OS is not an article generator.

It is an autonomous digital publishing company whose objective is to continuously increase the long-term value of a website through evidence-based optimization.

Articles are one output. The actual outputs are:

- More organic traffic
- Better user experience
- Greater trust
- Higher affiliate revenue
- Stronger brand recognition
- Better topical authority
- Better products
- Better decisions

Every action must be justifiable through measurable business outcomes — or, where measurement is not yet possible, through explicit reasoning that is recorded and revisited when measurement becomes possible.

**Mission:** Build the most trustworthy and useful resource within a niche while continuously learning faster than competitors.

**Long-term thesis:** The defensible asset is not the codebase, the articles, or the models. It is the *decision engine* — an accumulated body of validated causal knowledge about what changes produce what outcomes, and a disciplined process for extending it. That is substantially harder to replicate than an AI content pipeline.

**Important caveat on the thesis:** a single site in its first few years will mostly re-derive knowledge that is already public (comparison tables convert better; faster pages rank better) or knowledge so site-specific it does not transfer. The moat is real only in the multi-tenant configuration, where a principle confirmed across eight independent sites is genuine evidence rather than one site's noise. This is why multi-tenancy moved forward in the roadmap.

---

## 2. Company Constitution

These laws override every agent. They are enforced mechanically by the Policy Engine (§6), not by prompt instruction.

**Law 1 — Evidence beats reasoning.** Reasoning proposes. Data decides. Where data is unavailable, this must be stated explicitly rather than substituted with a fabricated confidence score.

**Law 2 — Every change must be reversible.** Nothing is permanent. Every deployment carries a rollback path recorded before it ships.

**Law 3 — Never optimize a local metric at the expense of company health.** Guardrail metrics are declared before every change, not after.

**Law 4 — Protect user trust above all else.** Short-term gains that reduce trust are forbidden.

**Law 5 — The brand evolves slowly.** Rapid identity changes are prohibited.

**Law 6 — Every experiment becomes institutional knowledge.** Including — especially — failures.

**Law 7 — No production change without a recorded rationale and a rollback condition.**
*(Revised from v1.0's "no production changes without experimentation," which is unenforceable at low traffic and led to the failure mode this specification exists to prevent.)*

**Law 8 — Large changes require exponentially stronger evidence.** Blast radius and evidence requirements scale together.

**Law 9 — Never claim more confidence than the data supports.** A change that could not be measured is recorded as unmeasured. Manufacturing a confidence score is the single most damaging thing an agent can do to this system, because it poisons the asset the entire platform is built to accumulate.

---

## 3. North Star Metric

Atlas does not optimize for article count. It optimizes for a weighted **Company Health Score** — with weights that shift by phase, because a fixed 30% revenue weight is meaningless when revenue is near zero and will swing wildly on single-conversion noise.

| Component | Phase 1 (0–1k) | Phase 2 (1k–10k) | Phase 3 (10k–100k) | Phase 4 (100k+) |
|---|---|---|---|---|
| Revenue growth | 0% | 15% | 30% | 30% |
| Organic traffic growth | 40% | 30% | 20% | 15% |
| Indexation & crawl health | 25% | 10% | 5% | 5% |
| Content quality score | 20% | 15% | 10% | 5% |
| User satisfaction | 5% | 10% | 15% | 15% |
| Returning visitors | 0% | 10% | 15% | 15% |
| Brand searches | 0% | 5% | 10% | 10% |
| Backlinks | 5% | 5% | 5% | 5% |
| Site health (CWV, errors) | 5% | 5% | 5% | 5% |

Rules:

- No individual metric may be optimized at the expense of the others.
- Any component contributing to a phase weight must have at least 30 days of stable measurement before it counts. New instrumentation does not immediately affect the score.
- **Content quality score** (Phases 1–2) is a rubric-based internal audit, not a traffic metric. It exists because in early phases there is no external signal to optimize against and something must anchor the loop. Rubric: factual verifiability, intent coverage, structural completeness, originality of information, readability. Scored by an evaluator model against a fixed rubric with periodic human spot-checks.

**Illustrative failure:** CTR increases 20% → bounce rate doubles → revenue drops → the experiment failed, regardless of the CTR win.

---

## 4. The Maturity Ladder

This is the central organizing concept of v2.0. Each rung unlocks methodology the previous rung cannot statistically support.

### Rung 0 — Foundation (0–1,000 sessions/month)

**Honest position: you cannot experiment here. Do not pretend to.**

At 1,000 monthly sessions with a 20% rollout cap, an experiment arm receives ~200 users per month. Detecting a 5% relative lift on a 3% baseline CTR requires on the order of 10⁵ sessions per arm. The experiment would take decades.

**What runs:**
- Full data capture (§7). Everything logged from day one.
- Policy Engine active (§6) — blast radius limits apply immediately and do not depend on traffic.
- Technical SEO, indexation, Core Web Vitals — these have deterministic pass/fail states and need no statistics.
- Content production against the quality rubric.
- **Decision Log**, not experiments. Every change records: what, when, why, expected direction, rollback condition. No p-values, no confidence scores.

**Primary KPI:** indexed pages, crawl health, traffic growth, content quality score.

**Strategy in one line:** produce genuinely good content, get indexed, be fast, be patient.

### Rung 1 — Directional Measurement (1k–10k sessions/month)

**What unlocks:**
- **Pre/post analysis with control cohorts.** Not A/B testing — before/after comparison against a matched set of unchanged pages, which controls for seasonality and algorithm updates.
- **Split-URL SEO testing** (§5.2) once ~100+ comparable pages exist.
- Large-effect CRO tests only. See the detection table below.
- Decision Log entries may be promoted to **Working Belief**.

**Detectable effect sizes** (80% power, α=0.05, two-sided; n ≈ 16σ²/δ² per arm):

| Baseline conversion | Relative lift | Sessions needed per arm |
|---|---|---|
| 5% | 50% | ~1,200 |
| 5% | 25% | ~4,900 |
| 5% | 10% | ~30,000 |
| 5% | 5% | ~122,000 |
| 2% | 50% | ~3,100 |
| 2% | 25% | ~12,500 |

Read this table before designing any test. At Rung 1, only the top rows are reachable. **Do not run tests you cannot power** — an underpowered test that "wins" is more likely to be noise than signal, and it will enter the knowledge base as a lie.

### Rung 2 — Controlled Experimentation (10k–100k sessions/month)

**What unlocks:**
- True A/B testing for on-page CRO, layout, affiliate placement, CTAs.
- Sequential testing with pre-registered stopping rules.
- Concurrent experiments — but capped, with interaction checks (§5.4).
- Working Beliefs may be promoted to **Principle**.
- The full v1.0 pipeline becomes appropriate here. This is the rung the original specification was written for.

### Rung 3 — Compounding (100k+ sessions/month, or multi-tenant)

**What unlocks:**
- Multivariate testing.
- Cross-site principle validation (the actual moat).
- Predictive modeling: estimating outcomes with less experimentation.
- Original research, community features, internationalization.
- Human reviewers where beneficial.

**Note:** a portfolio of eight Rung-1 sites can reach Rung 2 or 3 statistical power *in aggregate* for platform-level questions, even while each individual site is small. This is the strongest argument for early multi-tenancy.

---

## 5. Experimentation Framework

### 5.1 Standard pipeline (Rung 2+)

```
Observe → Hypothesis → Predict → Design → Power check → Canary
→ A/B Test → Analyze → Record → Expand → Production
```

Every proposal must specify, *before* it runs:

- Observation (with data reference)
- Hypothesis (causal mechanism, not just correlation)
- Prediction and expected effect size
- Primary metric and **guardrail metrics**
- Minimum detectable effect and required sample size
- Planned duration and stopping rule
- Rollback threshold

**Worked example:**

> **Observation:** CTR on buying-guide pages declined 14% over 6 weeks.
> **Hypothesis:** Titles lack the specificity users scan for in SERPs.
> **Prediction:** Adding exact spec values to titles increases CTR.
> **Primary metric:** CTR. **Guardrails:** bounce rate, revenue per visitor.
> **MDE:** +15% relative. **Required sample:** ~8,000 impressions per cohort.
> **Method:** Split-URL, 40 pages per cohort, 8 weeks.
> **Rollback:** CTR down 3% or RPV down 5% at any checkpoint.

### 5.2 SEO testing is different — split-URL cohorts

**This is a correction, not a refinement.** Google indexes one version of a URL. Serving variants to different visitors does not change what the crawler sees; serving variants to the crawler is cloaking. Classic A/B testing therefore cannot measure SEO effects at all.

The correct method:

1. **Assemble a page population.** Minimum ~100 comparable pages; 200+ preferred.
2. **Stratify** on pre-period impressions, page type, and topical cluster.
3. **Randomly assign** to treatment and control within strata.
4. **Establish a pre-period baseline** — minimum 8 weeks of Search Console data.
5. **Apply the change to treatment pages only.**
6. **Forecast** what treatment pages *would* have done using control-cohort trajectory (CausalImpact-style Bayesian structural time series, or simple difference-in-differences as a floor).
7. **Measure the gap** over 8–12 weeks.

**Constraints to respect:**
- Minimum 6 weeks post-change before reading results; 8–12 preferred. Crawl, index, and ranking effects surface slowly.
- Core algorithm updates invalidate the window. Mark and re-run.
- Only one split-URL test per page population at a time.
- Sites with fewer than ~100 comparable pages cannot run this. They stay on decision logging.

### 5.3 What each method can and cannot test

| Change type | Valid method | Earliest rung |
|---|---|---|
| Button copy, CTA, colors | Client-side A/B | Rung 1 (large effects only) |
| Affiliate placement, table design | Client-side A/B | Rung 1–2 |
| Page layout, above-fold content | A/B + guardrails | Rung 2 |
| Title tags, meta descriptions | Split-URL cohort | Rung 1 (100+ pages) |
| Internal linking structure | Split-URL cohort | Rung 2 |
| Schema markup | Split-URL cohort | Rung 1 |
| Content depth / rewrites | Split-URL cohort | Rung 2 |
| Site architecture, navigation | Pre/post + control site | Rung 3 |
| Brand, voice, identity | Not testable — governed by policy | — |
| Core Web Vitals, broken links | Deterministic; no test needed | Rung 0 |

### 5.4 Concurrency

Concurrent experiments on a small site interfere constantly. Limits:

- Rung 1: one experiment at a time, full stop.
- Rung 2: maximum three concurrent, no two touching the same page population or the same primary metric.
- Rung 3: unlimited within Policy Engine caps, with mandatory interaction analysis.

### 5.5 Progressive rollout

Rollout caps from v1.0 are retained, with one correction: **they apply to rollout, not to experiment arms.** Capping experiment exposure at 1% on a large site defeats the purpose; capping *permanent* rollout is prudent.

| Traffic | Max single-step rollout |
|---|---|
| <1,000 | Direct with logging (nothing to test against) |
| 1k–10k | 50% steps, hold 2 weeks |
| 10k–100k | 25% → 50% → 100% |
| 100k+ | 10% → 25% → 50% → 100% |

Automatic rollback fires when any pre-declared threshold is breached.

---

## 6. The Policy Engine

**Built first. Non-optional. Sits between every agent and production.**

```
Agent → Policy Engine → [Method Check] → [Risk Engine] → Production
```

This is the component that prevents a single capable agent from making one catastrophic decision. It is the highest-value piece of the original architecture and it does not depend on traffic volume, so it is valuable from day one.

**Enforced rules:**

| Rule | Purpose |
|---|---|
| Max pages changed per deployment | Blast radius |
| Max concurrent experiments | Interaction control |
| Minimum confidence before rollout | Evidence discipline |
| Protected-page list requiring elevated approval | Protect proven earners |
| Rate limits on brand/navigation changes | Law 5 |
| Rollback triggers on KPI degradation | Law 2 |
| Freeze during algorithm updates or anomalies | Confound control |
| Statistical power pre-check | **Blocks tests that cannot resolve their claimed effect** |
| Content volume ceiling per week | Prevents thin-content flooding |

The power pre-check is new and it is the enforcement mechanism for Law 9. An agent proposing a test whose sample size cannot detect its stated MDE is rejected at the gate rather than allowed to produce a meaningless result.

**Risk tiers:**

| Change | Risk | Requirement |
|---|---|---|
| Button color | Low | Standard flow |
| Table layout on one template | Medium | Canary + guardrails |
| Site navigation | High | Multiple prior wins + staged rollout |
| Homepage rebuild, brand identity | Critical | Human approval, always |

---

## 7. Technical Architecture

### Principle 1 — AI is the last resort

```
Hard-coded Rules → Algorithms → Statistical Models
→ Local LLM → Cloud LLM → Large Reasoning Model
```

Every agent asks: *can this be solved without AI?* If yes, rules. If no, is it simple? Local model. Complex? Cloud. The router is retained from v1.0 unchanged — it is straightforwardly correct and saves substantial cost.

### Principle 2 — Everything is event driven

Agents do not poll. Events wake them.

```
Search Console updates → event → SEO agent wakes → decides → sleeps
Traffic drop → event → investigation routine
Core algorithm update detected → event → freeze + research
```

### Principle 3 — Everything becomes data

Never let information disappear. This is the cheapest thing to do correctly at the start and the most expensive to retrofit. Capture full analytics, experiments, errors, deployments, algorithm updates, competitor changes, and every agent decision **from day one, before any of it can be analyzed.** The history has value later even if it has none today.

### Stack

```
                        Website
                           │
              Analytics Collection Layer
      ┌────────────────────┼────────────────────┐
   Search /            User Behavior         Technical
   Analytics              Events              Metrics
      └────────────────────┼────────────────────┘
                           │
                  Event Queue (Redis)
                           │
              PostgreSQL + pgvector
                           │
                  Knowledge Database
                           │
                  Agent Orchestrator
                           │
                    POLICY ENGINE
                           │
              Method Check → Risk Engine
                           │
              Canary → Measurement → Rollout
                           │
                    Production Site
```

**Multi-tenant from day one.** Every table carries a `tenant_id` and a `scope` flag (`tenant` | `platform`). Adding this later is a migration nightmare; adding it now costs a column. Platform-scoped knowledge is what eventually becomes the moat.

**Core tables:** articles, page_versions, decisions, experiments, cohorts, measurements, analytics_daily, knowledge, brand_rules, roadmaps, competitors, deployments, rollbacks, agent_logs, policy_violations.

**Everything is replaceable.** Postgres today, something else tomorrow. All communication through interfaces.

### Memory layers

| Layer | Contents | Store |
|---|---|---|
| Working | Current tasks | Redis |
| Operational | Current site state | PostgreSQL |
| Institutional | Years of decisions and experiments | PostgreSQL |
| Semantic | Embeddings — find similar past attempts and failures | pgvector |

### Agent communication

Never agent → agent → agent. Always:

```
Agent → Knowledge Base → Event Queue → Orchestrator → Next Agent
```

Everything observable, everything replayable.

---

## 8. Knowledge Base — The Promotion Ladder

The most valuable asset in the system, and the easiest to corrupt. v1.0 stored "validated principles" with confidence percentages. v2.0 replaces this with a three-tier ladder where **the tier is determined by evidence quality, and confidence is only ever attached to Tier 3.**

### Tier 1 — Decision Log
Every change ever made. No statistical claim.

```
Type:        Decision
Date:        2027-04-12
Scope:       tenant:alpine-gear
Change:      Moved comparison table above fold, 12 buying guides
Rationale:   Established CRO practice; scroll-depth data shows 60% never reach it
Expected:    Increase in affiliate CTR
Measured:    Not measurable at current traffic
Rollback:    Snapshot ref #4471
Status:      Live, unverified
```

### Tier 2 — Working Belief
Directional evidence: pre/post with control cohort, or an underpowered but consistent result. Actionable, explicitly provisional.

```
Type:        Working Belief
Claim:       Comparison tables above fold increase affiliate CTR on buying guides
Evidence:    1 split-URL cohort test, 40 pages, 10 weeks, +9% (CI −2% to +20%)
Strength:    Directional — CI includes zero
Scope:       tenant:alpine-gear, buying guides only
Review:      Re-test at Rung 2
```

### Tier 3 — Principle
Promoted only after: three or more adequately powered confirmations, on at least two independent page populations, and — for platform scope — at least two independent tenants.

```
Type:        Principle
Claim:       Comparison tables of 7–10 products outperform 3–5 and 15+
Evidence:    11 powered tests, 4 tenants, 2027–2029
Effect:      +6.2% affiliate CTR (95% CI: +3.1% to +9.4%)
Scope:       platform
Last confirmed: 2029-06-04
Boundary:    Not validated for single-product review pages
```

**Rules:**

1. Confidence figures appear only on Tier 3. Nowhere else.
2. Every record names its scope: which tenant, which page type, which traffic band.
3. **Negative results are recorded with equal weight.** Knowing what does not work is half the asset, and it is the half that competitors cannot buy.
4. Agents query the base before proposing. Repeating a failed experiment without new justification is a policy violation.
5. Principles carry expiry review dates. Search behavior changes; a 2027 principle is not automatically true in 2030.
6. Anything already public and well-documented enters as Tier 2 at best, tagged `external-prior`, until independently confirmed. Do not fill the moat with things everyone knows.

---

## 9. Organization

v1.0 specified 17 agents across three layers. That models an AI system on a human company, and the analogy does not hold — human org charts exist to manage bandwidth limits and coordination costs that do not apply the same way to model calls sharing a database. Seventeen agents means seventeen prompts, most of them thin wrappers, plus latency and failure surface.

v2.0 collapses to **five functional roles**, expanded only when a specific bottleneck justifies it.

| Role | Owns | Replaces (v1.0) |
|---|---|---|
| **Strategist** | Roadmap, prioritization, resource allocation, weekly review | CEO, Growth Manager, Content Planner |
| **Analyst** | All measurement, anomaly detection, experiment design, statistical validation, dashboards | Scientific Method, Analytics, UX Analyst, SEO monitoring |
| **Builder** | Content creation and editing, on-page changes, technical SEO fixes | Writer, Editor, Technical SEO, SEO Strategist |
| **Scout** | Competitive intelligence, opportunity research, reputation monitoring, algorithm-update watch | Research, Competitor Intelligence, Reputation |
| **Operator** | Deployments, infra, monitoring, backups, agent health, CI/CD | Infrastructure, Automation |

**Not agents — system components:**
- **Policy Engine** — deterministic rules, not a model. Never negotiates.
- **Risk Engine** — scoring function.
- **Brand Rules** — a versioned document the Policy Engine enforces. Brand does not need an agent; it needs constraints that cannot be argued with.
- **AI Router** — routing logic.

**Separation of duties (retained and strengthened):** the role that proposes a change is never the role that evaluates it. Builder proposes; Analyst evaluates; Policy Engine gates; Operator deploys. This is the one place where organizational structure genuinely earns its cost.

**Human in the loop:** required for Critical-tier changes, brand identity, legal/compliance content, and quarterly knowledge-base audits at every rung. Atlas is autonomous in operation, not unsupervised in governance.

---

## 10. Operating Cadence

The v1.0 weekly cycle is retained for *operations* but decoupled from *measurement*, because a Thursday-deploy/Friday-review rhythm reads random walk as causality on SEO timescales.

**Weekly (operations):**
- Mon — review prior week, check anomalies and guardrails
- Tue — research and opportunity scan
- Wed — plan changes, design any experiments
- Thu — deploy canaries and content
- Fri — health check (*not* experiment conclusions)
- Sat — knowledge base maintenance
- Sun — Strategist regenerates roadmap

**Measurement cadence (separate, longer):**

| Signal | Read after | Never read before |
|---|---|---|
| Technical / CWV | Hours | — |
| On-page conversion | 2 weeks | 1 week |
| CTR from SERP | 6 weeks | 4 weeks |
| Rankings / traffic | 8–12 weeks | 6 weeks |
| Brand searches | 6 months | 3 months |

No experiment concludes on the weekly cycle. The weekly cycle checks *health*; conclusions happen on the experiment's own clock.

---

## 11. Analytics Taxonomy

Retained from v1.0 in full. Available to every role, scoped by tenant.

**Search:** impressions, clicks, CTR, average position, keyword movement, topical authority, backlinks, indexed pages, crawl errors, query mix, brand searches.

**Users:** sessions, users, returning users, bounce rate, dwell time, session duration, exit pages, heatmaps, scroll depth, navigation paths.

**Affiliate:** clicks, conversions, revenue, revenue per visitor, revenue per article, revenue per category, AOV, conversion rate.

**Technical:** Core Web Vitals (LCP, CLS, INP), Lighthouse, broken links, image weight, load time, JS errors.

**Business:** RPM, monthly growth, lifetime article value, newsletter subscribers, brand growth, content quality score.

---

## 12. Failure Detection

**Watch for:** ranking drops, CTR decline, revenue decline, traffic anomalies, algorithm updates, brand complaints, negative reviews, affiliate program changes, indexation loss.

**Response protocol:**
1. **Freeze** — Policy Engine halts all experiments and non-critical deployments.
2. **Isolate** — was this us, or was this external? Check the decision log against the timeline; check whether unchanged control cohorts moved too.
3. **Investigate** before hypothesizing. Do not skip to a fix.
4. **Rollback** if internally caused and rollback is available.
5. **Record** — outcome enters the knowledge base regardless of resolution.
6. **Resume** only after two clean measurement periods.

Never panic. Most volatility is noise; the discipline is in distinguishing noise from signal, not in reacting fast.

---

## 13. Brand Principles

**Never become:** clickbait, spam, AI slop, keyword-stuffed, thin.

**Instead become:** helpful, reliable, transparent, consistent, expert, trustworthy.

Brand trust compounds, and it is the one asset with no rollback. This is why brand rules live in the Policy Engine as hard constraints rather than in an agent's judgment.

Transparency commitments: disclose affiliate relationships, disclose AI involvement in content production, correct errors visibly, never fabricate testing or first-hand experience the system did not have. Law 4 is not a soft preference — a trust failure is unrecoverable in a way that a traffic dip is not.

---

## 14. Build Order

1. **Data layer + event capture + multi-tenant schema.** Nothing else works without it, and it cannot be retrofitted.
2. **Policy Engine + rollback machinery.** Value from day one, independent of traffic.
3. **AI Router.** Immediate cost savings.
4. **Decision Log.** Tier 1 knowledge base. Cheap, and it is the raw material for everything later.
5. **Builder + Operator roles.** Get content shipping and deployments safe.
6. **Analyst role — monitoring and anomaly detection only.** No experiment engine yet.
7. **Content quality rubric + evaluator.** The Phase 1 feedback loop.
8. *— Reaching Rung 1 (~1k sessions) —*
9. **Split-URL cohort testing.** First real measurement capability.
10. **Working Belief tier + promotion workflow.**
11. *— Reaching Rung 2 (~10k sessions) —*
12. **Full A/B infrastructure, power checks, sequential testing.**
13. **Principle tier + cross-population validation.**
14. **Second tenant.** The moat begins here, not at 100k sessions.
15. **Predictive modeling from accumulated evidence.**

Steps 1–7 are buildable now and are the majority of the durable engineering. Steps 9 onward wait for traffic that justifies them.

---

## 15. Long-Term Vision

The objective is not an AI writer. It is a company that continuously improves itself.

Every experiment makes the organization slightly smarter. Every failure becomes institutional knowledge. Every success becomes a reusable principle — once, and only once, it has earned that label.

Each year, the gap between Atlas and a newly created affiliate site should widen. Not because Atlas publishes more, but because it has accumulated thousands of validated decisions, a mature brand, a deep understanding of its audience, and a disciplined optimization process.

The end state is a publishing platform where content creation is a small part of the operation. Most effort goes toward understanding users, measuring outcomes, learning from evidence, protecting trust, and making incremental improvements that compound over years.

**The risk this document exists to prevent:** that the *appearance* of rigor — significance thresholds, confidence scores, experiment counts — outruns the underlying data, and the system begins trusting its own noise. A knowledge base full of manufactured confidence is worse than no knowledge base, because agents will act on it with certainty it has not earned, and each subsequent decision compounds the error.

Rigor that is honest about its own limits is what compounds. Rigor that is performed is what fails slowly and invisibly.

---

*End of specification.*
