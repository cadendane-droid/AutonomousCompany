# 1. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

This system's entire premise is that decisions are recorded with their reasoning
and revisited when evidence arrives. Applying that to the product but not to the
architecture would be inconsistent in an obvious way.

Architecture decisions also have a specific failure mode here: the repository is
partly written by agents, and an agent reading a codebase cannot infer why a
structural choice was made. Absent a record, it will eventually "improve" a
deliberate constraint into a bug.

## Decision

Architecture decisions are recorded as numbered Markdown files in `docs/adr/`,
using the template below. A decision is added when a choice would be expensive
to reverse, is likely to be questioned later, or deliberately rejects the
obvious option.

ADRs are immutable once accepted. A reversal is a new ADR that supersedes the
old one; the old file stays, with its status updated to `Superseded by NNNN`.

## Consequences

- Anyone — human or agent — can find out why something is the way it is.
- The cost is a file per decision. That is cheap relative to re-litigating.
- ADRs will go stale in the sense that some become historical rather than
  current. That is fine and expected; the status field carries that.

## Template

```markdown
# N. Short title in the imperative

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context

The forces at play. What makes this decision necessary. Include the constraints
that are not negotiable and the ones that only look non-negotiable.

## Decision

What was decided, stated actively: "We will…".

## Consequences

What becomes easier, what becomes harder, and what this commits us to. Include
the costs honestly — an ADR listing only benefits has not thought it through.

## Alternatives considered

What else was on the table and why it lost. This is the section that stops the
decision being re-made from scratch in six months.
```
