// TIER A: fully working. Structured output — markdown for the PR comment,
// JSON for the database.
import type { PolicyReport } from './types.js';

export function toMarkdown(report: PolicyReport): string {
  const icon = (status: string) =>
    status === 'pass' ? '✅' : status === 'not-applicable' ? '➖' : '❌';

  const lines = [
    `## Policy Engine — ${report.pass ? 'PASS ✅' : 'FAIL ❌'}`,
    '',
    '| Check | Type | Result | Detail |',
    '|---|---|---|---|',
    ...report.results.map(
      (r) =>
        `| ${r.name} | ${r.kind} | ${icon(r.status)} ${r.status} | ${r.message.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`,
    ),
    '',
    report.pass
      ? 'All checks passed. Merge is permitted subject to required human review.'
      : 'One or more checks failed. **This PR cannot merge.** There is no override mechanism; fix the violations or withdraw the proposal.',
    '',
    `<sub>Generated ${report.generatedAt} · policy/rules.yml is the authority · checks fail closed</sub>`,
  ];
  return lines.join('\n');
}

export function toJson(report: PolicyReport): string {
  return JSON.stringify(report, null, 2);
}
