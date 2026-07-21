// TIER A: the worker loop's own logic, with the data layer mocked. Covers the
// properties that matter — freeze is respected, an unroutable job fails rather
// than being silently dropped, and a handler throw records the run and applies
// backoff instead of losing the job.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job, Tenant } from '@atlas/core';

const tenant: Tenant = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'tenant-alpha',
  domain: 'example-tenant.com',
  niche: null,
  launched_at: null,
  rung: 0,
  created_at: new Date(),
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    tenant_id: tenant.id,
    role: 'builder',
    kind: 'draft-article',
    payload: null,
    status: 'running',
    priority: 5,
    attempts: 1,
    max_attempts: 3,
    run_after: null,
    locked_at: null,
    locked_by: null,
    last_error: null,
    created_at: new Date(),
    ...overrides,
  } as Job;
}

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  heartbeat: vi.fn(),
  isFrozen: vi.fn(),
  listTenants: vi.fn(),
  recordAgentRun: vi.fn(),
  reapStale: vi.fn(),
}));

vi.mock('@atlas/db', () => mocks);

const handler = vi.fn();
vi.mock('./roles/index.js', async () => {
  const actual = await vi.importActual<typeof import('./roles/index.js')>('./roles/index.js');
  return {
    ...actual,
    ROLE_HANDLERS: {
      builder: {
        'draft-article': (...args: unknown[]) => handler(...args),
      },
      operator: { 'health-check': async () => 'healthy' },
      analyst: {},
      scout: {},
      strategist: {},
    },
  };
});

const { runPass } = await import('./worker.js');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listTenants.mockResolvedValue([tenant]);
  mocks.isFrozen.mockResolvedValue(false);
  mocks.claim.mockResolvedValue([]);
  mocks.complete.mockResolvedValue(undefined);
  mocks.fail.mockResolvedValue(undefined);
  mocks.heartbeat.mockResolvedValue(undefined);
  mocks.recordAgentRun.mockResolvedValue(undefined);
});

/** claim() is called once per role; only answer for the named one. */
function claimFor(role: string, jobs: Job[]): void {
  mocks.claim.mockImplementation(async (r: string) => (r === role ? jobs : []));
}

describe('worker pass', () => {
  it('dispatches a claimed job to its role handler and completes it', async () => {
    claimFor('builder', [makeJob()]);
    handler.mockResolvedValue('PR opened');

    const result = await runPass({ roles: ['builder'] });

    expect(handler).toHaveBeenCalledOnce();
    expect(mocks.complete).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222');
    expect(result).toMatchObject({ claimed: 1, succeeded: 1, failed: 0 });
  });

  it('records an agent_runs row with the outcome', async () => {
    claimFor('builder', [makeJob()]);
    handler.mockResolvedValue('PR opened');

    await runPass({ roles: ['builder'] });

    expect(mocks.recordAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'builder', outcome: 'PR opened' }),
    );
  });

  it('defers a non-operator job while the tenant is frozen', async () => {
    mocks.isFrozen.mockResolvedValue(true);
    claimFor('builder', [makeJob()]);

    const result = await runPass({ roles: ['builder'] });

    expect(handler).not.toHaveBeenCalled();
    expect(result.skippedFrozen).toBe(1);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('still runs operator jobs while frozen, so the system can observe its way out', async () => {
    mocks.isFrozen.mockResolvedValue(true);
    claimFor('operator', [makeJob({ role: 'operator', kind: 'health-check' })]);

    const result = await runPass({ roles: ['operator'] });

    expect(result).toMatchObject({ succeeded: 1, skippedFrozen: 0 });
  });

  it('fails an unroutable job rather than silently dropping it', async () => {
    claimFor('builder', [makeJob({ kind: 'no-such-kind' })]);

    const result = await runPass({ roles: ['builder'] });

    expect(result.failed).toBe(1);
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('no handler'),
    );
  });

  it('records the error and applies backoff when a handler throws', async () => {
    claimFor('builder', [makeJob()]);
    handler.mockRejectedValue(new Error('fact-check found 2 unsupported claims'));

    const result = await runPass({ roles: ['builder'] });

    expect(result.failed).toBe(1);
    expect(mocks.recordAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'error', error: expect.stringContaining('fact-check') }),
    );
    expect(mocks.fail).toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('fails a job whose tenant does not exist', async () => {
    claimFor('builder', [makeJob({ tenant_id: '99999999-9999-9999-9999-999999999999' })]);

    const result = await runPass({ roles: ['builder'] });

    expect(result.failed).toBe(1);
    expect(mocks.fail).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('unknown tenant'),
    );
  });
});
