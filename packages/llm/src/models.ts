// TIER A logic / TIER B pricing values.
//
// ONE config file for model identifiers and pricing — never scatter model ids
// through the code. Change a model in exactly one place: here.
//
// Model ids and per-MTok pricing verified against Anthropic docs 2026-07-21.
// TODO(setup): re-verify ids/pricing before launch (models and prices change;
// see OPEN-QUESTIONS.md §3). Cost tracking in client.ts multiplies these.
import type { ModelTier } from '@atlas/core';

export interface ModelConfig {
  /** Anthropic model id; null for tiers that never call a model. */
  model: string | null;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  maxTokens: number;
}

export const MODEL_CONFIG: Record<ModelTier, ModelConfig> = {
  /** Deterministic code. No model, no cost. */
  rules: { model: null, inputUsdPerMTok: 0, outputUsdPerMTok: 0, maxTokens: 0 },
  /**
   * Spec tier "Local LLM". No local model is provisioned at this stage —
   * calls route to the cheapest cloud model instead, which at this volume
   * costs less than operating local inference.
   * TODO(setup): if/when a local model (e.g. via Ollama) is provisioned,
   * point this at it and add a local transport in client.ts.
   */
  local: { model: 'claude-haiku-4-5', inputUsdPerMTok: 1, outputUsdPerMTok: 5, maxTokens: 4096 },
  'cloud-small': {
    model: 'claude-haiku-4-5',
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    maxTokens: 8192,
  },
  'cloud-capable': {
    model: 'claude-sonnet-5',
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
    maxTokens: 16000,
  },
  reasoning: {
    model: 'claude-opus-4-8',
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
    maxTokens: 16000,
  },
};

export function costUsd(tier: ModelTier, inputTokens: number, outputTokens: number): number {
  const config = MODEL_CONFIG[tier];
  return (
    (inputTokens / 1_000_000) * config.inputUsdPerMTok +
    (outputTokens / 1_000_000) * config.outputUsdPerMTok
  );
}
