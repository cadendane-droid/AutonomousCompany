import { z } from 'zod';
import {
  DecisionKindSchema,
  ExperimentMethodSchema,
  ExternalEventKindSchema,
  JobStatusSchema,
  ModelTierSchema,
  PageTypeSchema,
  RoleNameSchema,
  RungSchema,
} from './enums.js';

/** Row shapes mirror db/migrations exactly — do not improvise column names. */

export const TenantSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  domain: z.string(),
  niche: z.string().nullable(),
  launched_at: z.coerce.date().nullable(),
  rung: RungSchema,
  created_at: z.coerce.date(),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const PageSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  slug: z.string(),
  path: z.string(),
  type: PageTypeSchema,
  cluster: z.string().nullable(),
  protected: z.boolean(),
  published_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
  quality_score: z.number().nullable(),
  cohort_id: z.string().uuid().nullable(),
});
export type Page = z.infer<typeof PageSchema>;

export const DecisionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  date: z.coerce.date(),
  role: RoleNameSchema.nullable(),
  kind: DecisionKindSchema.nullable(),
  summary: z.string(),
  rationale: z.string(),
  expected_direction: z.string().nullable(),
  affected_pages: z.array(z.string().uuid()).nullable(),
  /** Required, no default — honesty is forced, not defaulted (Law 9). */
  measurable: z.boolean(),
  measurement_plan: z.string().nullable(),
  guardrails: z.unknown().nullable(),
  /** NOT NULL in the database — Law 2 enforced at the storage layer. */
  rollback_ref: z.string(),
  pr_url: z.string().nullable(),
  outcome: z.string().nullable(),
  reviewed_at: z.coerce.date().nullable(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const JobSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  role: RoleNameSchema,
  kind: z.string(),
  payload: z.unknown().nullable(),
  status: JobStatusSchema,
  priority: z.number().int(),
  attempts: z.number().int(),
  max_attempts: z.number().int(),
  run_after: z.coerce.date().nullable(),
  locked_at: z.coerce.date().nullable(),
  locked_by: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.coerce.date(),
});
export type Job = z.infer<typeof JobSchema>;

export const AgentRunSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid().nullable(),
  tenant_id: z.string().uuid().nullable(),
  role: RoleNameSchema.nullable(),
  model_tier: ModelTierSchema.nullable(),
  model: z.string().nullable(),
  input_tokens: z.number().int().nullable(),
  output_tokens: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  duration_ms: z.number().int().nullable(),
  outcome: z.string().nullable(),
  error: z.string().nullable(),
  created_at: z.coerce.date(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const CohortSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  experiment_id: z.string().uuid().nullable(),
  arm: z.enum(['treatment', 'control']),
  strata_key: z.string().nullable(),
  page_ids: z.array(z.string().uuid()),
  assigned_at: z.coerce.date(),
});
export type Cohort = z.infer<typeof CohortSchema>;

export const ExperimentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  method: ExperimentMethodSchema,
  status: z.enum(['designed', 'running', 'reading', 'concluded', 'invalidated']),
  hypothesis: z.string(),
  primary_metric: z.string(),
  guardrails: z.unknown().nullable(),
  baseline_rate: z.number().nullable(),
  mde_relative: z.number().nullable(),
  required_n_per_arm: z.number().int().nullable(),
  planned_duration_days: z.number().int().nullable(),
  stopping_rule: z.string().nullable(),
  rollback_threshold: z.string().nullable(),
  page_population: z.string().nullable(),
  started_at: z.coerce.date().nullable(),
  concluded_at: z.coerce.date().nullable(),
  result_summary: z.string().nullable(),
  created_at: z.coerce.date(),
});
export type Experiment = z.infer<typeof ExperimentSchema>;

export const ExternalEventSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  date: z.coerce.date(),
  kind: ExternalEventKindSchema,
  description: z.string().nullable(),
  severity: z.enum(['low', 'medium', 'high']).nullable(),
  source: z.string().nullable(),
});
export type ExternalEvent = z.infer<typeof ExternalEventSchema>;

export const SystemStateSchema = z.object({
  tenant_id: z.string().uuid(),
  frozen: z.boolean(),
  freeze_reason: z.string().nullable(),
  frozen_at: z.coerce.date().nullable(),
  set_by: z.string().nullable(),
  updated_at: z.coerce.date(),
});
export type SystemState = z.infer<typeof SystemStateSchema>;
