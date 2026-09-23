import type { Pricing } from './env';

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
}

export interface CostEstimate {
  inputUsd: number | null;
  outputUsd: number | null;
  totalUsd: number | null;
}

const NO_COST: CostEstimate = { inputUsd: null, outputUsd: null, totalUsd: null };

/** Separate input/output pricing; null whenever pricing or token counts are unknown. */
export function estimateCost(usage: TokenUsage | null, pricing: Pricing | null): CostEstimate {
  if (!usage || !pricing) return NO_COST;
  const inputUsd =
    usage.inputTokens === null ? null : (usage.inputTokens / 1_000_000) * pricing.inputUsdPer1M;
  const outputUsd =
    usage.outputTokens === null ? null : (usage.outputTokens / 1_000_000) * pricing.outputUsdPer1M;
  return {
    inputUsd,
    outputUsd,
    totalUsd: inputUsd === null || outputUsd === null ? null : inputUsd + outputUsd,
  };
}
