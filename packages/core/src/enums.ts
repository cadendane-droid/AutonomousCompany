import { z } from 'zod';

/** Maturity ladder position (spec §4). Stored on tenants.rung. */
export const RungSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type Rung = z.infer<typeof RungSchema>;

/** The five functional roles (spec §9). Never seventeen. */
export const RoleNameSchema = z.enum(['strategist', 'analyst', 'builder', 'scout', 'operator']);
export type RoleName = z.infer<typeof RoleNameSchema>;

/** AI router tiers (spec §7 principle 1, plan §6.2). */
export const ModelTierSchema = z.enum(['rules', 'local', 'cloud-small', 'cloud-capable', 'reasoning']);
export type ModelTier = z.infer<typeof ModelTierSchema>;

/** Decision categories (plan §7.3). */
export const DecisionKindSchema = z.enum(['content', 'technical', 'layout', 'meta', 'infrastructure']);
export type DecisionKind = z.infer<typeof DecisionKindSchema>;

/** Risk tiers (spec §6). Critical always requires human approval. */
export const RiskTierSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskTier = z.infer<typeof RiskTierSchema>;

/**
 * Knowledge promotion ladder (spec §8).
 * Confidence figures may ONLY appear on 'principle' records — Law 9.
 */
export const KnowledgeTierSchema = z.enum(['decision', 'working-belief', 'principle']);
export type KnowledgeTier = z.infer<typeof KnowledgeTierSchema>;

/** Knowledge scope: tenant-specific or cross-tenant platform knowledge. */
export const KnowledgeScopeSchema = z.enum(['tenant', 'platform']);
export type KnowledgeScope = z.infer<typeof KnowledgeScopeSchema>;

/** Page types — drive cohort stratification (plan §3.1). */
export const PageTypeSchema = z.enum(['buying-guide', 'review', 'comparison']);
export type PageType = z.infer<typeof PageTypeSchema>;

/** Job lifecycle in the Postgres queue. */
export const JobStatusSchema = z.enum(['pending', 'running', 'done', 'failed', 'dead']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/** Experiment methods by rung (spec §5.3). */
export const ExperimentMethodSchema = z.enum([
  'decision-log', // Rung 0: log, don't test
  'pre-post-cohort', // Rung 1: before/after vs matched control pages
  'split-url-cohort', // Rung 1+ (100+ pages): SEO testing
  'ab-test', // Rung 2: client-side CRO
  'sequential', // Rung 2: pre-registered stopping rules
  'multivariate', // Rung 3
]);
export type ExperimentMethod = z.infer<typeof ExperimentMethodSchema>;

/** External event kinds (plan §4.1). */
export const ExternalEventKindSchema = z.enum([
  'algo_update',
  'seasonal',
  'competitor',
  'program_change',
  'other',
]);
export type ExternalEventKind = z.infer<typeof ExternalEventKindSchema>;
