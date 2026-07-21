-- 0003: pages — implementation plan §4.1, transcribed exactly.
-- Reversal (manual): drop table pages;

create table if not exists pages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  slug          text not null,
  path          text not null,
  type          text not null,              -- buying-guide | review | comparison
  cluster       text,
  protected     boolean default false,
  published_at  date,
  updated_at    date,
  quality_score numeric,
  cohort_id     uuid,                       -- null until split-URL testing
  unique (tenant_id, path)
);
