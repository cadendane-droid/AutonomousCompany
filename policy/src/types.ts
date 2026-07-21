// TIER A: pure types and Zod schemas for the check protocol.
import { z } from 'zod';
import { RungSchema, type Proposal } from '@atlas/core';
import type { PolicyRules } from './config.js';

/** One changed file parsed from a unified diff. */
export interface DiffFile {
  path: string;
  oldPath: string | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  addedLines: string[];
}

export interface ParsedDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * System state the checks need, supplied by the CI workflow (which queries
 * the database) or a --state file locally. NOT derivable from the PR itself —
 * by design, nothing in the PR can influence it.
 */
export const PolicyStateSchema = z.object({
  rung: RungSchema,
  frozen: z.boolean(),
  freeze_reason: z.string().nullable().optional(),
  running_experiments: z.number().int().min(0),
  /** Content pages published in the trailing 7 days (blast radius). */
  new_pages_last_7d: z.number().int().min(0),
  /**
   * True only when a HUMAN has approved via GitHub's own review mechanism.
   * The workflow sets this from the reviews API — never from labels, commit
   * messages, or anything an agent can write.
   */
  human_approved: z.boolean(),
  /** Trailing 28-day sessions, for power-check traffic sanity. */
  monthly_sessions: z.number().min(0).optional(),
  /**
   * Lighthouse performance scores, supplied by the CI workflow after it runs
   * LHCI against the Vercel preview deploy. Null when no preview was measured.
   * Like every other field here, it comes from the workflow and not from the
   * PR — a PR cannot report its own score.
   */
  lighthouse: z
    .object({
      /** Score on the base branch, for regression comparison. */
      baseline: z.number().min(0).max(100).nullable(),
      /** Score on this PR's preview deploy. */
      preview: z.number().min(0).max(100),
    })
    .nullable()
    .optional(),
});
export type PolicyState = z.infer<typeof PolicyStateSchema>;

export interface CheckContext {
  diff: ParsedDiff;
  /** Parsed proposal, or null when parsing failed (itself a policy failure). */
  proposal: Proposal | null;
  proposalError: string | null;
  rules: PolicyRules;
  state: PolicyState;
  /** Repo root with the PR's head checked out — content checks read files here. */
  repoRoot: string;
}

export type CheckStatus = 'pass' | 'fail' | 'not-applicable';

export interface CheckResult {
  name: string;
  kind: 'deterministic' | 'model';
  status: CheckStatus;
  message: string;
  details?: unknown;
}

export interface PolicyCheck {
  name: string;
  kind: 'deterministic' | 'model';
  run(ctx: CheckContext): Promise<Omit<CheckResult, 'name' | 'kind'>>;
}

export interface PolicyReport {
  pass: boolean;
  results: CheckResult[];
  generatedAt: string;
}