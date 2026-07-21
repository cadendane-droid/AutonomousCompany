-- 0011: knowledge — the tiered promotion ladder (spec §8).
-- tier: decision | working-belief | principle.
-- scope: tenant | platform. Platform-scoped principles are the moat.
-- confidence_interval may ONLY be non-null on tier='principle' — enforced by
-- a CHECK constraint, because Law 9 is a mechanical rule, not a convention.
-- Reversal (manual): drop table knowledge;

create table if not exists knowledge (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references tenants(id),   -- null when scope = 'platform'
  scope           text not null default 'tenant' check (scope in ('tenant', 'platform')),
  tier            text not null check (tier in ('decision', 'working-belief', 'principle')),
  claim           text not null,
  evidence        text not null,
  strength        text,                          -- e.g. "Directional — CI includes zero"
  effect_summary  text,                          -- e.g. "+9% (CI −2% to +20%)"
  -- Confidence lives ONLY on Tier 3 (spec §8 rule 1).
  confidence_interval text check (confidence_interval is null or tier = 'principle'),
  boundary        text,                          -- where the claim is NOT validated
  page_type       text,
  traffic_band    text,
  tags            text[] default '{}',           -- includes 'external-prior' where applicable
  source_decision_ids uuid[] default '{}',
  review_at       date,                          -- principles carry expiry review dates
  last_confirmed  date,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  embedding       vector(1536)
);
