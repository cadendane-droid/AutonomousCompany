// TIER A: fully working.
//
// Parses the structured PR body (plan §6.3) into a core Proposal and
// validates with Zod. A malformed proposal is a policy failure — the parser
// returns the error rather than throwing so the runner can report it.
import { parse as parseYaml } from 'yaml';
import {
  ExperimentPlanSchema,
  ProposalSchema,
  RiskTierSchema,
  type Proposal,
} from '@atlas/core';

export interface ParseResult {
  proposal: Proposal | null;
  error: string | null;
}

/** Split "## Heading" sections of a markdown body into a name→content map. */
function sections(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = body.split(/^## +/m).slice(1);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    if (newline === -1) continue;
    const heading = part.slice(0, newline).trim().toLowerCase();
    map.set(heading, part.slice(newline + 1).trim());
  }
  return map;
}

function parseBool(text: string): boolean | null {
  const first = text.trim().split(/[\s.,—-]/)[0]?.toLowerCase();
  if (first === 'yes' || first === 'true') return true;
  if (first === 'no' || first === 'false') return false;
  return null;
}

export function parseProposal(body: string): ParseResult {
  try {
    const s = sections(body);

    const missing = ['proposal', 'rationale', 'expected direction', 'measurable', 'guardrails', 'rollback', 'risk']
      .filter((name) => !s.has(name));
    if (missing.length > 0) {
      return { proposal: null, error: `missing required sections: ${missing.map((m) => `## ${m}`).join(', ')}` };
    }

    const measurableText = s.get('measurable')!;
    const measurable = parseBool(measurableText);
    if (measurable === null) {
      return {
        proposal: null,
        error: '## Measurable must start with Yes or No — an honest boolean, not prose (Law 9)',
      };
    }

    // Guardrails: one per line or comma-separated; strip list markers.
    const guardrails = s
      .get('guardrails')!
      .split(/[\n,]/)
      .map((g) => g.replace(/^[-*]\s*/, '').replace(/\.\s*$/, '').trim())
      .filter(Boolean);

    // Rollback: "method. Condition: <condition>" or two lines.
    const rollbackText = s.get('rollback')!;
    const conditionMatch = rollbackText.match(/condition:\s*([\s\S]+)/i);
    const method = conditionMatch
      ? rollbackText.slice(0, conditionMatch.index).replace(/[.\s]+$/, '').trim()
      : rollbackText.split('\n')[0]?.trim() ?? '';
    const condition = conditionMatch?.[1]?.trim() ?? '';

    const riskText = s.get('risk')!.trim().split(/[\s.,]/)[0]?.toLowerCase() ?? '';
    const risk = RiskTierSchema.safeParse(riskText);
    if (!risk.success) {
      return { proposal: null, error: `## Risk must be one of low|medium|high|critical, got "${riskText}"` };
    }

    // Optional ## Experiment section: a YAML block with the plan fields.
    let experiment;
    if (s.has('experiment')) {
      const yamlText = s.get('experiment')!.replace(/```(?:yaml)?|```/g, '').trim();
      const parsed = ExperimentPlanSchema.safeParse(parseYaml(yamlText));
      if (!parsed.success) {
        return {
          proposal: null,
          error: `## Experiment section invalid: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
        };
      }
      experiment = parsed.data;
    }

    const candidate = {
      proposal: s.get('proposal')!,
      rationale: s.get('rationale')!,
      expected_direction: s.get('expected direction')!,
      measurable,
      measurable_note: measurableText,
      guardrails,
      rollback: { method, condition },
      risk: risk.data,
      ...(experiment ? { experiment } : {}),
    };

    const validated = ProposalSchema.safeParse(candidate);
    if (!validated.success) {
      return {
        proposal: null,
        error: validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      };
    }
    return { proposal: validated.data, error: null };
  } catch (err) {
    return { proposal: null, error: `proposal parse error: ${err instanceof Error ? err.message : err}` };
  }
}
