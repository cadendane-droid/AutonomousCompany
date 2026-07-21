// TIER B: logic complete, untested against a live Postgres / GitHub API.
//
// Builds the PolicyState JSON the Policy Engine reads, from the database and
// the GitHub reviews API. Emits JSON on stdout; the workflow redirects it.
//
// THE POINT OF THIS FILE: every field here comes from a source the pull request
// cannot write to. `human_approved` is derived from GitHub's own review
// mechanism — an APPROVED review, on the current head commit, from someone with
// write access. Not a label, not a commit-message token, not a file in the PR.
// An agent can write anything into a PR; it cannot approve its own review.
import process from 'node:process';
import { getSystemState, getTenantBySlug, query } from '@atlas/db';
import { DEFAULT_TENANT_SLUG, requireEnv } from '@atlas/core';
import { arg } from './lib/args.ts';

interface Review {
  state: string;
  commit_id: string;
  author_association: string;
  user: { login: string } | null;
}

/** Associations that mean the reviewer has write access to this repository. */
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

async function humanApproved(): Promise<boolean> {
  const prNumber = process.env['PR_NUMBER'];
  const repo = process.env['GITHUB_REPO'];
  const token = process.env['GITHUB_TOKEN'];

  // No PR context (a local run) is treated as unapproved. Fail closed.
  if (!prNumber || !repo || !token) return false;

  const headSha = process.env['PR_HEAD_SHA'];

  const response = await fetch(
    `https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    // An unreadable reviews API is not an approval.
    console.error(`reviews API returned ${response.status}; treating as not approved`);
    return false;
  }

  const reviews = (await response.json()) as Review[];

  return reviews.some(
    (review) =>
      review.state === 'APPROVED' &&
      TRUSTED_ASSOCIATIONS.has(review.author_association) &&
      // An approval of an earlier commit does not approve later pushes.
      (headSha === undefined || review.commit_id === headSha),
  );
}

async function main(): Promise<void> {
  const tenantSlug = arg('tenant') ?? DEFAULT_TENANT_SLUG;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error(`tenant "${tenantSlug}" not found — run pnpm db:seed first`);

  const state = await getSystemState(tenant.id);

  const running = await query<{ count: string }>(
    `select count(*)::text as count from experiments
      where tenant_id = $1 and status = 'running'`,
    [tenant.id],
  );

  const newPages = await query<{ count: string }>(
    `select count(*)::text as count from pages
      where tenant_id = $1 and published_at >= current_date - interval '7 days'`,
    [tenant.id],
  );

  const sessions = await query<{ total: string | null }>(
    `select sum(sessions)::text as total from behavior_metrics
      where tenant_id = $1 and date >= current_date - interval '28 days'`,
    [tenant.id],
  );

  process.stdout.write(
    JSON.stringify(
      {
        rung: tenant.rung,
        frozen: state?.frozen ?? false,
        freeze_reason: state?.freeze_reason ?? null,
        running_experiments: Number(running[0]?.count ?? 0),
        new_pages_last_7d: Number(newPages[0]?.count ?? 0),
        human_approved: await humanApproved(),
        monthly_sessions: Number(sessions[0]?.total ?? 0),
        // Supplied by the Lighthouse CI job when a preview deploy was measured.
        lighthouse: null,
      },
      null,
      2,
    ) + '\n',
  );
}

try {
  requireEnv('DATABASE_URL');
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  const { closePool } = await import('@atlas/db');
  await closePool();
}
