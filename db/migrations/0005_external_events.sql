-- 0005: external_events — implementation plan §4.1, transcribed exactly.
-- The confounder record every future measurement depends on. "Was there a
-- confounder in this window" is unanswerable retroactively.
-- Reversal (manual): drop table external_events;

create table if not exists external_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id),   -- null = platform-wide
  date          date not null,
  kind          text not null,                 -- algo_update | seasonal | competitor | program_change
  description   text,
  severity      text,
  source        text
);
