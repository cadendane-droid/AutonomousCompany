// TIER A: pure registry. The five functional roles (spec §9) — never seventeen.
//
// Adding a role is a change here plus a directory; the worker dispatches
// entirely from this table and knows nothing about individual roles.
import type { RoleName } from '@atlas/core';
import type { RoleHandlers } from './types.js';
import { builderHandlers } from './builder/index.js';
import { operatorHandlers } from './operator/index.js';
import { analystHandlers } from './analyst/index.js';
import { scoutHandlers } from './scout/index.js';
import { strategistHandlers } from './strategist/index.js';

export const ROLE_HANDLERS: Record<RoleName, RoleHandlers> = {
  builder: builderHandlers,
  operator: operatorHandlers,
  analyst: analystHandlers,
  scout: scoutHandlers,
  strategist: strategistHandlers,
};

/**
 * Roles permitted to run while the system is frozen (spec §12). Freeze halts
 * experiments and non-critical deployments; Operator must keep running or the
 * system cannot observe its way back out of a freeze. Only a human unfreezes.
 */
export const ROLES_ALLOWED_WHILE_FROZEN: readonly RoleName[] = ['operator'];

export * from './types.js';
