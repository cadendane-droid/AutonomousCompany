# 3. A Postgres job table, not Redis

- **Status:** Accepted
- **Date:** 2026-07-21

## Context

The v1.0 architecture specified Redis as the event queue, and the v2.0 stack
diagram still shows it. Every reference architecture for an agent system has a
message broker in it.

The actual workload is dozens of jobs per day. Not thousands per second — dozens
per day. A content site's agent runtime wakes up a handful of times daily,
drafts something, and goes back to sleep.

## Decision

The job queue is a Postgres table drained with `FOR UPDATE SKIP LOCKED`. No
Redis, no broker, no separate queue service.

`packages/db/src/queue.ts` is the entire implementation: `enqueue`, `claim`,
`complete`, `fail`, `heartbeat`, `reapStale`.

## Consequences

- One less piece of infrastructure to provision, secure, monitor, back up, and
  pay for.
- Jobs are in the same database and the same transaction scope as everything
  else they touch, so a job and its side effects commit or roll back together.
  A Redis queue plus a Postgres write is two systems that can disagree.
- Job state is queryable with SQL, which means debugging a stuck queue is a
  `select`, and the `v_ingest_freshness` style of monitoring extends to it
  naturally.
- `SKIP LOCKED` makes concurrent workers safe, so this does not foreclose
  scaling out. What it forecloses is throughput far beyond what this system will
  ever need.

The honest cost: if this system ever did need thousands of jobs per second, this
would have to be replaced. That threshold is roughly four orders of magnitude
away, and the replacement would be a contained change behind the queue module's
existing interface.

## Alternatives considered

**Redis, as specified in v1.0.** Premature at every rung below 3. It adds an
operational surface with no capability this workload can use, and it introduces
the two-systems consistency problem above.

**A hosted queue (SQS, etc.).** Same objection, plus a network hop and a vendor,
to replace roughly eighty lines of SQL.
