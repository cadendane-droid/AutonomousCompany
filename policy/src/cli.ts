// CLI: pnpm policy:check --diff <file> --proposal <file> [--state <file>]
//   [--repo-root <dir>] [--format md|json] [--deterministic-only]
//
// The CI workflow supplies --state from the database + GitHub reviews API.
// Without --state, a conservative default state is used (rung 0, not frozen,
// zero running experiments, NOT human-approved) so local runs behave like an
// unreviewed PR.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { loadRules } from './config.js';
import { parseDiff } from './diff.js';
import { parseProposal } from './proposal-parser.js';
import { toJson, toMarkdown } from './report.js';
import { PolicyStateSchema, type PolicyState } from './types.js';
import { runPolicy } from './index.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const diffPath = arg('diff');
const proposalPath = arg('proposal');
if (!diffPath || !proposalPath) {
  console.error(
    'usage: policy:check --diff <file> --proposal <file> [--state <file>] ' +
      '[--repo-root <dir>] [--format md|json] [--deterministic-only]',
  );
  process.exit(2);
}

const repoRoot = resolve(arg('repo-root') ?? '.');
const rules = loadRules(resolve(repoRoot, 'policy/rules.yml'));
const diff = parseDiff(readFileSync(resolve(diffPath), 'utf8'));
const { proposal, error: proposalError } = parseProposal(readFileSync(resolve(proposalPath), 'utf8'));

const statePath = arg('state');
const state: PolicyState = statePath
  ? PolicyStateSchema.parse(JSON.parse(readFileSync(resolve(statePath), 'utf8')))
  : {
      // Conservative defaults for local runs — an unreviewed rung-0 PR.
      rung: 0,
      frozen: false,
      running_experiments: 0,
      new_pages_last_7d: 0,
      human_approved: false,
    };

const report = await runPolicy(
  { diff, proposal, proposalError, rules, state, repoRoot },
  { deterministicOnly: process.argv.includes('--deterministic-only') },
);

console.log(arg('format') === 'json' ? toJson(report) : toMarkdown(report));
process.exit(report.pass ? 0 : 1);
