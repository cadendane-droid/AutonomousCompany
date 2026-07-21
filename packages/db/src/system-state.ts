// TIER B: logic complete, untested against live API (needs a running Postgres).
import { SystemStateSchema, type SystemState } from '@atlas/core';
import { query } from './client.js';

export async function getSystemState(tenantId: string): Promise<SystemState | null> {
  const rows = await query('select * from system_state where tenant_id = $1', [tenantId]);
  return rows[0] ? SystemStateSchema.parse(rows[0]) : null;
}

export async function isFrozen(tenantId: string): Promise<boolean> {
  return (await getSystemState(tenantId))?.frozen ?? false;
}

/** Freezing is cheap. Anomaly detection and humans may both call this. */
export async function freeze(tenantId: string, reason: string, setBy: string): Promise<void> {
  await query(
    `insert into system_state (tenant_id, frozen, freeze_reason, frozen_at, set_by, updated_at)
     values ($1, true, $2, now(), $3, now())
     on conflict (tenant_id) do update
       set frozen = true, freeze_reason = $2, frozen_at = now(), set_by = $3, updated_at = now()`,
    [tenantId, reason, setBy],
  );
}

/**
 * Unfreezing is a deliberate act. Policy: only a human clears a freeze
 * (rules.yml freeze.manual_override: human_only). Callers must pass the
 * human's identity; agent code paths never call this.
 */
export async function unfreeze(tenantId: string, humanName: string): Promise<void> {
  await query(
    `update system_state
     set frozen = false, freeze_reason = null, set_by = $2, updated_at = now()
     where tenant_id = $1`,
    [tenantId, `human:${humanName}`],
  );
}
