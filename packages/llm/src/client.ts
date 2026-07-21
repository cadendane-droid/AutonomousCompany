// TIER B: logic complete, untested against live API (needs ANTHROPIC_API_KEY
// and a running Postgres for agent_runs logging).
import Anthropic from '@anthropic-ai/sdk';
import { optionalEnv, requireEnv, type ModelTier, type RoleName } from '@atlas/core';
import { monthSpendUsd, recordAgentRun } from '@atlas/db';
import { costUsd, MODEL_CONFIG } from './models.js';
import { applyBudget, tierForTask } from './router.js';

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  }
  return anthropic;
}

export interface LlmCallInput {
  taskKind: string;
  system: string;
  prompt: string;
  /** For agent_runs attribution. */
  jobId?: string | null;
  tenantId?: string | null;
  role?: RoleName | null;
  maxTokens?: number;
}

export interface LlmCallResult {
  text: string;
  tier: ModelTier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export class BudgetExhaustedError extends Error {
  constructor(reason: string) {
    super(`LLM budget hard stop: ${reason}`);
    this.name = 'BudgetExhaustedError';
  }
}

/**
 * The single entry point for every model call in the system. Routes by task
 * kind, applies the budget cap, calls Anthropic, and logs the run — tokens,
 * cost, duration, tier, outcome — to agent_runs. Nothing calls the Anthropic
 * SDK directly outside this file.
 */
export async function callLlm(input: LlmCallInput): Promise<LlmCallResult> {
  const requestedTier = tierForTask(input.taskKind);
  if (requestedTier === 'rules') {
    throw new Error(
      `Task "${input.taskKind}" is routed to the rules tier — it must be solved ` +
        `in code, not with a model call (spec §7: AI is the last resort).`,
    );
  }

  const budgetUsd = Number(optionalEnv('ATLAS_LLM_MONTHLY_BUDGET_USD', '100'));
  const spend = await monthSpendUsd();
  const decision = applyBudget(requestedTier, spend, budgetUsd);
  if (decision.blocked) {
    throw new BudgetExhaustedError(decision.reason);
  }

  const config = MODEL_CONFIG[decision.tier];
  if (!config.model) {
    throw new Error(`Tier ${decision.tier} has no model configured`);
  }

  const started = Date.now();
  try {
    const response = await getAnthropic().messages.create({
      model: config.model,
      max_tokens: input.maxTokens ?? config.maxTokens,
      system: input.system,
      messages: [{ role: 'user', content: input.prompt }],
    });

    const durationMs = Date.now() - started;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cost = costUsd(decision.tier, inputTokens, outputTokens);

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    await recordAgentRun({
      jobId: input.jobId ?? null,
      tenantId: input.tenantId ?? null,
      role: input.role ?? null,
      modelTier: decision.tier,
      model: config.model,
      inputTokens,
      outputTokens,
      costUsd: cost,
      durationMs,
      outcome: decision.degraded ? `ok (${decision.reason})` : 'ok',
    });

    return {
      text,
      tier: decision.tier,
      model: config.model,
      inputTokens,
      outputTokens,
      costUsd: cost,
      durationMs,
    };
  } catch (err) {
    await recordAgentRun({
      jobId: input.jobId ?? null,
      tenantId: input.tenantId ?? null,
      role: input.role ?? null,
      modelTier: decision.tier,
      model: config.model,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      durationMs: Date.now() - started,
      outcome: 'error',
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {
      // Logging failure must not mask the original error.
    });
    throw err;
  }
}
