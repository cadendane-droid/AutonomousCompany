# 4. The Policy Engine is a CI check, not a service

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

The Policy Engine exists to prevent a single capable agent from making one
catastrophic decision. It enforces the Constitution mechanically rather than by
prompt instruction, because prompt instructions are suggestions.

The obvious implementation is a service the agent calls before acting. The
problem is the word "before": anything the agent calls, the agent can also
decline to call, or call with different arguments, or retry until it passes.

## Decision

The Policy Engine is a GitHub Action that evaluates the pull request diff and
proposal body against `policy/rules.yml`, and blocks the merge on violation.

Three properties follow, and all three are load-bearing:

1. **It runs on the change, not on a description of the change.** The diff is
   the ground truth.
2. **It is not invocable by the agent, so it cannot be skipped by the agent.**
   There is no override token, no skip label, no commit-message escape hatch,
   and no `deterministic-only` flag reachable from PR content.
3. **Human approval is expressed only through GitHub's own review mechanism.**
   `scripts/policy-state.ts` derives `human_approved` from the reviews API — an
   APPROVED review on the current head commit from an account with write access.
   An agent can write anything into a pull request; it cannot approve a review.

The engine also **fails closed**: any check that throws is recorded as a
failure, never as a pass. See `policy/src/index.ts`.

## Consequences

- An LLM cannot negotiate with a failing CI check. That property is the entire
  point, and it is why this is not a service.
- Threshold changes require a commit to `policy/rules.yml`, which is a protected
  path. "Relaxing a threshold just this once" becomes a reviewable diff instead
  of a runtime argument.
- Checks that need system state — freeze status, current rung, concurrent
  experiment count — get it from the database via the workflow, not from the PR.
- The cost is latency: policy feedback arrives at CI time rather than at
  generation time. For a system that opens a handful of PRs a day, that is
  irrelevant.
- A second cost, worth naming: **branch protection must be configured for any of
  this to bind.** Until `policy-check` is a required status check, the workflow
  reports failures that nothing enforces. That is SETUP.md step 9, and it is the
  single most important configuration step in the repository.

## Alternatives considered

**A service the agent calls.** Skippable by construction. Also evaluates a
description of the change rather than the change.

**A pre-commit hook.** Runs on the agent's own machine, under the agent's
control. Worse than the service option.

**Prompt instructions.** This is what the Constitution says not to do, and the
reason the Policy Engine exists at all.
