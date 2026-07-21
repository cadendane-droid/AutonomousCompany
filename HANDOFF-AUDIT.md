# Handoff Audit

A previous session scaffolded this repo and stopped mid-build when it ran out of
credits. This file records the state it was found in, verified mechanically
rather than by inspection. It is disposable once the scaffold is complete.

**Audited:** 2026-07-21, at commit `af19fea`.

## Mechanical baseline (run before any changes)

| Command | Result |
|---|---|
| `pnpm install` | passes — 8 workspace projects resolved |
| `pnpm typecheck` | passes — 7 of 8 projects (`site` does not exist) |
| `pnpm test` | passes — 92 tests across core, stats, llm, policy |
| `pnpm build` | passes — exit 0 |
| `pnpm lint` | **fails** — 1 error, unused `_atlas` in `packages/core/src/rungs.test.ts:55` |

No file was found truncated mid-write. Every `.ts` file parses and ends at a
clean statement boundary. The interruption landed cleanly between build items,
not inside one — the repo compiles as found.

## Build item status

| # | Item | Status | Evidence | What remains |
|---|---|---|---|---|
| 1 | Repo foundation | **PARTIAL** | install/typecheck/test/build pass; `pnpm lint` fails on one unused var; `pnpm-workspace.yaml` lists `site`, which does not exist | Fix lint error; `site` resolves once item 10 lands |
| 2 | `packages/core` | **COMPLETE** | All 9 entity schemas, frontmatter matching plan §3.1 incl. nested `atlas` block, 7 enums, `RUNG_DEFINITIONS` as a data table keyed by rung with thresholds/methods/concurrency/promotable tiers | Add Tier markers (ground rule 3 applies to every module; core files carry none) |
| 3 | `db/migrations` | **COMPLETE** | 0001–0013 all present. Spot-checked 0002 and 0007 against plan §4.1/§7.3 — transcribed exactly. `decisions.rollback_ref` is `not null` (Law 2), `decisions.measurable` is `not null` with no default (Law 9). Every table carries `tenant_id`. Each migration documents its manual reversal | — |
| 4 | `packages/db` | **COMPLETE** | Typed client, migration runner with `schema_migrations`, query modules per domain, `SKIP LOCKED` queue with enqueue/claim/complete/fail/heartbeat. Tier B marked throughout | — |
| 5 | `packages/stats` | **COMPLETE** | 40 passing tests across power, did, anomaly, health-score, cohorts. Tier A marked | Verify the spec §4 effect-size table is asserted as a fixture |
| 6 | `policy/` | **PARTIAL** | 11 checks implemented and wired into `ALL_CHECKS`; fail-closed runner confirmed (a throwing check records `fail`); no override reachable from PR content; `rules.yml` transcribes plan §5.2 in full; 41 tests | **2 of the 13 checks in plan §5.3 are missing:** Lighthouse-on-preview regression, and brand-voice conformance |
| 7 | `packages/llm` | **COMPLETE** | Tiered router with task→tier config table, budget cap with degradation and hard stop, structured-output helper, single `models.ts` config. 11 tests | Model ids are current as of the cutoff; flag for verification |
| 8 | `ingest/` | **COMPLETE** | All 5 connectors + `runner.ts` with retry/backoff and staleness assertion. Tier B marked | — |
| 9 | `agents/` | **PARTIAL** | Present: `context.ts` (incl. pgvector semantic recall), `queue.ts`, `prompts.ts`, `proposals/`, `roles/builder/` with the six-step pipeline, and all 5 system prompts. **Missing: `worker.ts`** — the runtime entry point — and the `operator/`, `analyst/`, `scout/`, `strategist/` role directories | Build worker loop, operator substantively, other three as Tier C |
| 10 | `site/` | **MISSING** | Directory does not exist, despite being listed in `pnpm-workspace.yaml` | Entire Astro site |
| 11 | `.github/workflows/` | **MISSING** | Directory does not exist | All 6 workflows |
| 12 | `scripts/` | **MISSING** | Directory does not exist, but root `package.json` already references 8 scripts in it — every one of those pnpm scripts is currently broken | All 8 scripts |
| 13 | Documentation | **MISSING** | No `README.md`, `SETUP.md`, `docs/architecture.md`, `docs/runbook.md`, or `docs/adr/` | All of it |
| — | `OPEN-QUESTIONS.md` | **MISSING** | Never started — so no prior Section 2 reasoning survives to merge with | Write in full |

## Notes carried into the repair work

- **No secrets found.** `.env.example` contains only placeholders. Every env
  read goes through `requireEnv`/`optionalEnv`; the 15 variables read in code
  are all declared in `.env.example`. Nothing to rotate.
- **`dist/` is correctly gitignored** and untracked, despite being present on
  disk from the prior session's builds.
- **The prior session's work is good.** Rung logic is genuinely a data
  structure the Policy Engine reads rather than scattered conditionals; the
  fail-closed runner is correct; migrations are faithful transcriptions. Per
  the handoff instructions, none of it is being rewritten.
- **Spec filenames differ from both prompts.** The specs are at
  `docs/atlas-os-master-spec-v2.md` and `docs/atlas-os-implementation-plan.md`;
  the build prompt is at `docs/claude-code-scaffold-prompt.md`, not
  `docs/build-prompt.md`. No action needed, but references should use the real
  names.
