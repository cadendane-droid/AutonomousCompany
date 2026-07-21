-- 0010: cohorts + experiments — implementation plan §9.1 (cohorts transcribed
-- exactly) plus the experiments record the cohort rows reference.
-- Created NOW, unused until Rung 1. Experiment EXECUTION is deliberately not
-- built at this stage — tables only.
-- Reversal (manual): drop table cohorts, experiments;

create table if not exists experiments (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id),
  name                  text not null,
  method                text not null,       -- see core ExperimentMethod enum
  status                text not null default 'designed', -- designed|running|reading|concluded|invalidated
  hypothesis            text not null,
  primary_metric        text not null,
  guardrails            jsonb,
  baseline_rate         numeric,
  mde_relative          numeric,
  required_n_per_arm    int,
  planned_duration_days int,
  stopping_rule         text,                -- pre-registered BEFORE launch, enforced
  rollback_threshold    text,
  page_population       text,                -- one split-URL test per population at a time
  started_at            timestamptz,
  concluded_at          timestamptz,
  result_summary        text,
  created_at            timestamptz default now()
);

create table if not exists cohorts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  experiment_id uuid references experiments(id),
  arm           text not null,        -- treatment | control
  strata_key    text,
  page_ids      uuid[] not null,
  assigned_at   timestamptz default now()
);
