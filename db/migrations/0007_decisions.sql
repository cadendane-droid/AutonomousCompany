-- 0007: decisions — implementation plan §7.3, transcribed exactly.
-- Two constraints that matter more than they look:
--   * measurable is required with NO default — honesty is forced (Law 9)
--   * rollback_ref is NOT NULL — Law 2 enforced by the database
-- Reversal (manual): drop table decisions;

create table if not exists decisions (
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
