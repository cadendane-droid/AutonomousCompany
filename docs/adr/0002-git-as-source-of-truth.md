# 2. Git is the source of truth for content

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

Content has to live somewhere. The default instinct for a publishing system is a
database table of articles with a CMS on top, which is what the v1.0
architecture implied.

But Law 2 requires every change to be reversible, with a rollback path recorded
before it ships. Law 7 requires every production change to carry a recorded
rationale. And the Policy Engine has to sit somewhere between an agent's
proposal and production, evaluating the actual change rather than a description
of it.

## Decision

Content is Markdown files with frontmatter, in this repository. Agents ship
changes as pull requests. Nothing writes to production content directly.

## Consequences

This buys, without writing any of it:

- Complete version history of every page.
- Atomic rollback — `git revert`, which is also the literal value stored in
  `decisions.rollback_ref`.
- Diffs, which is what makes review by a human or by the Policy Engine possible
  at all.
- Preview environments per change, via Vercel's PR deploys.
- A CI hook where the Policy Engine can sit and block merges.

Law 2 becomes a property of the storage layer rather than something the system
has to remember to do. That is the whole argument.

The costs are real:

- Content editing requires a Git round-trip. There is no CMS UI, and building
  one is explicitly out of scope.
- Very large content volumes would eventually strain a repository. At the scale
  this system operates at — hundreds of articles, not millions — that is far
  away.
- The database still holds a `pages` row per page for metrics joins, so page
  identity exists in two places and must be kept aligned. `pages.path` is the
  join key.

## Alternatives considered

**Database as source of truth, Git as export.** Rollback becomes something the
application implements and can get wrong, review requires building a diff view,
and the Policy Engine needs a bespoke integration point. Every property listed
above would have to be built rather than inherited.

**Headless CMS.** Adds a vendor between the agent and the content, and the
agent's output would need to round-trip through an API that was not designed for
machine authorship. The review story is worse than a pull request's.
