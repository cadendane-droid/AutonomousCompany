-- 0002: tenants — implementation plan §4.1, transcribed exactly.
-- Multi-tenant from day one; every other table references tenants(id).
-- Reversal (manual): drop table tenants;

create table if not exists tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  domain        text not null,
  niche         text,
  launched_at   date,
  rung          int not null default 0,     -- maturity ladder position
  created_at    timestamptz default now()
);
