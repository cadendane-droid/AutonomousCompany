-- 0008: system_state — freeze mechanism (implementation plan §5.4).
-- One row per tenant. The Policy Engine CI check reads it; anomaly detection
-- sets it automatically; ONLY a human clears it (freeze.manual_override:
-- human_only in policy/rules.yml).
-- Reversal (manual): drop table system_state;

create table if not exists system_state (
  tenant_id     uuid primary key references tenants(id),
  frozen        boolean not null default false,
  freeze_reason text,
  frozen_at     timestamptz,
  set_by        text,               -- 'anomaly-detector' | 'human:<name>' | ...
  updated_at    timestamptz not null default now()
);
