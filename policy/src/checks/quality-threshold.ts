// TIER B: logic complete, untested against live API (model-evaluated check).
//
// Scores changed content against brand/quality-rubric.md and checks brand
// voice against brand/rules.md, via the tiered router (cloud-small). Fails
// closed: an API error is a failure, not a pass.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { callLlmStructured } from '@atlas/llm';
import type { PolicyCheck } from '../types.js';
import { changedContentFiles, readContentFile } from '../content.js';

const ScoreSchema = z.object({
  factual_verifiability: z.number().min(1).max(5),
  intent_coverage: z.number().min(1).max(5),
  structural_completeness: z.number().min(1).max(5),
  information_originality: z.number().min(1).max(5),
  readability: z.number().min(1).max(5),
  brand_voice_violations: z.array(z.string()),
  notes: z.string(),
});

export const qualityThreshold: PolicyCheck = {
  name: 'quality-threshold',
  kind: 'model',
  async run(ctx) {
    const files = changedContentFiles(ctx);
    if (files.length === 0) {
      return { status: 'not-applicable', message: 'no content files changed' };
    }

    const rubric = readFileSync(join(ctx.repoRoot, 'brand/quality-rubric.md'), 'utf8');
    const brandRules = readFileSync(
      join(ctx.repoRoot, ctx.rules.brand.voice_rules_file),
      'utf8',
    );

    const problems: string[] = [];
    const scores: Record<string, number> = {};

    for (const file of files) {
      const parsed = readContentFile(ctx.repoRoot, file.path);
      if (!parsed) continue;

      const result = await callLlmStructured(
        {
          taskKind: 'content-quality-scoring',
          system:
            'You are the Atlas OS content evaluator. Score strictly against the rubric; ' +
            'an unanchored evaluator drifts toward 4s — resist that. Also flag any brand ' +
            'voice violations against the brand rules. Emit JSON with keys ' +
            'factual_verifiability, intent_coverage, structural_completeness, ' +
            'information_originality, readability (each 1-5), brand_voice_violations ' +
            '(string array), notes (string).',
          prompt: `# Rubric\n${rubric}\n\n# Brand rules\n${brandRules}\n\n# Article (${file.path})\n${parsed.raw}`,
        },
        ScoreSchema,
      );

      const composite =
        (result.factual_verifiability +
          result.intent_coverage +
          result.structural_completeness +
          result.information_originality +
          result.readability) /
        5;
      scores[file.path] = composite;

      if (composite < ctx.rules.content.min_quality_score) {
        problems.push(
          `${file.path}: quality ${composite.toFixed(2)} < ${ctx.rules.content.min_quality_score} (${result.notes})`,
        );
      }
      for (const violation of result.brand_voice_violations) {
        problems.push(`${file.path}: brand voice — ${violation}`);
      }
    }

    return problems.length > 0
      ? { status: 'fail', message: problems.join('; '), details: { scores, problems } }
      : { status: 'pass', message: 'quality and brand voice pass', details: { scores } };
  },
};
