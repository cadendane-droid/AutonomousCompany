-- 0006: jobs + agent_runs — implementation plan §6.1, transcribed exactly,
-- plus four queue-operations columns the plan's SKIP LOCKED design requires
-- (max_attempts, run_after, locked_by, last_error) and model-attribution
-- columns on agent_runs (tenant_id, model). Additions are documented in
-- OPEN-QUESTIONS.md §2.
-- Reversal (manual): drop table agent_runs, jobs;

create table if not exists jobs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id),
  role         text not null,        -- strategist|analyst|builder|scout|operator
  kind         text not null,
  payload      jsonb,
  status       text default 'pending',
  priority     int default 5,
  attempts     int default 0,
  max_attempts int not null default 3,
  run_after    timestamptz,                    -- backoff scheduling
  locked_at    timestamptz,
  locked_by    text,                           -- worker id, for heartbeat/reaping
  last_error   text,
  created_at   timestamptz default now()
);

create table if not exists agent_runs (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references jobs(id),
  tenant_id    uuid references tenants(id),
  role         text,
  model_tier   text,                 -- rules|local|cloud-small|cloud-capable|reasoning
  model        text,                 -- concrete model id used
  input_tokens int,
  output_tokens int,
  cost_usd     numeric,
  duration_ms  int,
  outcome      text,
  error        text,
  created_at   timestamptz default now()
);
