// TIER B: logic complete, untested against live API (GitHub REST + git).
//
// Constructs the structured PR body (plan §6.3), opens the PR via the GitHub
// API, and links it to a decisions row. Output is ALWAYS a pull request —
// never a direct write to main.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { requireEnv, type DecisionKind, type Proposal, type RoleName } from '@atlas/core';
import { logDecision } from '@atlas/db';

/** Render a core Proposal into the machine-readable PR body the Policy Engine parses. */
export function renderProposalBody(proposal: Proposal): string {
  const lines = [
    '## Proposal',
    proposal.proposal,
    '',
    '## Rationale',
    proposal.rationale,
    '',
    '## Expected direction',
    proposal.expected_direction,
    '',
    '## Measurable',
    proposal.measurable
      ? `Yes — ${proposal.measurable_note ?? ''}`.trim()
      : `No — ${proposal.measurable_note ?? 'not measurable at current traffic; logged as Tier 1 decision.'}`.trim(),
    '',
    '## Guardrails',
    proposal.guardrails.map((g) => `- ${g}`).join('\n'),
    '',
    '## Rollback',
    `${proposal.rollback.method}. Condition: ${proposal.rollback.condition}`,
    '',
    '## Risk',
    proposal.risk,
  ];
  if (proposal.experiment) {
    lines.push(
      '',
      '## Experiment',
      '```yaml',
      `method: ${proposal.experiment.method}`,
      `primary_metric: ${proposal.experiment.primary_metric}`,
      `baseline_rate: ${proposal.experiment.baseline_rate}`,
      `mde_relative: ${proposal.experiment.mde_relative}`,
      `traffic_per_arm_per_day: ${proposal.experiment.traffic_per_arm_per_day}`,
      `planned_duration_days: ${proposal.experiment.planned_duration_days}`,
      `stopping_rule: ${proposal.experiment.stopping_rule}`,
      '```',
    );
  }
  return lines.join('\n');
}

export interface FileChange {
  /** Repo-relative path. */
  path: string;
  content: string;
}

export interface OpenProposalInput {
  tenantId: string;
  role: RoleName;
  kind: DecisionKind;
  branchName: string;
  title: string;
  proposal: Proposal;
  files: FileChange[];
  /** Repo working directory (a checkout with push rights). */
  repoRoot: string;
}

export interface OpenProposalResult {
  prUrl: string;
  decisionId: string;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

/**
 * Write files on a branch, push, open the PR, and record the Tier 1 decision.
 * rollback_ref is the base commit sha — Law 2 satisfied structurally by git.
 */
export async function openProposal(input: OpenProposalInput): Promise<OpenProposalResult> {
  const token = requireEnv('GITHUB_TOKEN');
  const repo = requireEnv('GITHUB_REPO'); // owner/name

  const baseSha = git(input.repoRoot, ['rev-parse', 'HEAD']);
  git(input.repoRoot, ['checkout', '-b', input.branchName]);
  try {
    for (const file of input.files) {
      const absolute = join(input.repoRoot, file.path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, file.content);
      git(input.repoRoot, ['add', file.path]);
    }
    git(input.repoRoot, ['commit', '-m', input.title]);
    git(input.repoRoot, ['push', '-u', 'origin', input.branchName]);
  } finally {
    git(input.repoRoot, ['checkout', '-']);
  }

  const body = renderProposalBody(input.proposal);
  const response = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ title: input.title, head: input.branchName, base: 'main', body }),
  });
  if (!response.ok) {
    throw new Error(`GitHub PR creation failed: ${response.status} ${await response.text()}`);
  }
  const pr = (await response.json()) as { html_url: string };

  const decision = await logDecision({
    tenantId: input.tenantId,
    date: new Date(),
    role: input.role,
    kind: input.kind,
    summary: input.proposal.proposal,
    rationale: input.proposal.rationale,
    expectedDirection: input.proposal.expected_direction,
    affectedPages: null,
    measurable: input.proposal.measurable,
    measurementPlan: input.proposal.experiment
      ? JSON.stringify(input.proposal.experiment)
      : null,
    guardrails: input.proposal.guardrails,
    rollbackRef: `git:${baseSha}`,
    prUrl: pr.html_url,
  });

  return { prUrl: pr.html_url, decisionId: decision.id };
}
