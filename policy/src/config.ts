// TIER A: fully working.
//
// Zod-validated load of policy/rules.yml. A malformed rules file is a hard
// error — the Policy Engine fails closed, it does not guess.
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export const PolicyRulesSchema = z.object({
  blast_radius: z.object({
    max_files_changed: z.number().int().positive(),
    max_lines_changed: z.number().int().positive(),
    max_new_pages_per_week: z.number().int().positive(),
    max_deletions_per_pr: z.number().int().min(0),
  }),
  protected: z.object({
    paths: z.array(z.string()),
    requires: z.literal('human_approval'),
  }),
  brand: z.object({
    navigation_changes_per_quarter: z.number().int().min(0),
    voice_rules_file: z.string(),
    required_components: z.object({
      monetized_pages: z.array(z.string()),
    }),
  }),
  experiments: z.object({
    max_concurrent_by_rung: z.record(z.string(), z.number().int().min(0)),
    require_power_check: z.boolean(),
    min_power: z.number().min(0).max(1).default(0.8),
    require_guardrails: z.boolean(),
    min_duration_days_by_type: z.object({
      conversion: z.number().int().positive(),
      ctr: z.number().int().positive(),
      ranking: z.number().int().positive(),
    }),
  }),
  freeze: z.object({
    on_algorithm_update: z.boolean(),
    on_traffic_anomaly_sigma: z.number().positive(),
    on_revenue_drop_pct: z.number().positive(),
    manual_override: z.literal('human_only'),
  }),
  content: z.object({
    min_quality_score: z.number().min(1).max(5),
    require_frontmatter_fields: z.array(z.string()),
    require_sources_section: z.boolean(),
  }),
  technical: z.object({
    /**
     * When true, a PR touching site/ must carry a preview Lighthouse score or
     * the check fails closed. Off until Vercel preview + LHCI are wired, since
     * there is no preview environment to measure against yet. Flipping it is a
     * commit to this file, which is a protected path — no agent can reach it.
     */
    require_lighthouse: z.boolean(),
    /** Plan §5.3: regression greater than this many points blocks. */
    max_lighthouse_regression: z.number().min(0),
    /** Plan §3.2: Lighthouse 95+ on mobile before the first article ships. */
    min_lighthouse: z.number().min(0).max(100),
  }),
});
export type PolicyRules = z.infer<typeof PolicyRulesSchema>;

export function loadRules(path: string): PolicyRules {
  const raw = readFileSync(path, 'utf8');
  return PolicyRulesSchema.parse(parseYaml(raw));
}
