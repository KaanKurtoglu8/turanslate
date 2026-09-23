/** Worker bindings and parsed configuration. */

export interface Env {
  DB: D1Database;
  /** Secret. */
  OPENAI_API_KEY?: string;
  /** Secret: HMAC key used to hash session tokens before storage. */
  SESSION_SECRET?: string;
  /** Comma-separated list of exact browser origins allowed by CORS. */
  ALLOWED_ORIGINS?: string;
  OPENAI_MODEL?: string;
  /** Optional; omitted from the request when empty (for non-reasoning models). */
  OPENAI_REASONING_EFFORT?: string;
  OPENAI_MAX_OUTPUT_TOKENS?: string;
  OPENAI_TIMEOUT_MS?: string;
  OPENAI_INPUT_USD_PER_1M?: string;
  OPENAI_OUTPUT_USD_PER_1M?: string;
  SESSION_TTL_HOURS?: string;
}

export interface Pricing {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

export interface Config {
  allowedOrigins: string[];
  model: string;
  reasoningEffort: string | null;
  maxOutputTokens: number;
  timeoutMs: number;
  pricing: Pricing | null;
  sessionTtlMs: number;
}

export const DEFAULT_MODEL = 'gpt-6-sol';

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return raw !== undefined && raw.trim() !== '' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function nonNegativeNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function readConfig(env: Env): Config {
  const inputPrice = nonNegativeNumber(env.OPENAI_INPUT_USD_PER_1M);
  const outputPrice = nonNegativeNumber(env.OPENAI_OUTPUT_USD_PER_1M);
  return {
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    model: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    reasoningEffort: env.OPENAI_REASONING_EFFORT?.trim() || null,
    maxOutputTokens: Math.floor(positiveNumber(env.OPENAI_MAX_OUTPUT_TOKENS, 4000)),
    timeoutMs: Math.floor(positiveNumber(env.OPENAI_TIMEOUT_MS, 60_000)),
    pricing:
      inputPrice !== null && outputPrice !== null
        ? { inputUsdPer1M: inputPrice, outputUsdPer1M: outputPrice }
        : null,
    sessionTtlMs: positiveNumber(env.SESSION_TTL_HOURS, 12) * 60 * 60 * 1000,
  };
}
