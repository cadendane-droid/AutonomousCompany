-- 0009: ingest_runs — implementation plan §4.3.
-- Every connector run writes a row with status and row counts. A connector
-- that silently stops is worse than one that never existed — the staleness
-- assertion in ingest/runner.ts reads this table.
-- Reversal (manual): drop table ingest_runs;

create table if not exists ingest_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id),
  connector     text not null,       -- search-console | posthog | affiliate | technical | external-events
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running',  -- running | ok | failed
  rows_written  int,
  date_from     date,
  date_to       date,
  error         text
);
