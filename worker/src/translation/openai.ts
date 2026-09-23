/**
 * The only module that knows about OpenAI. It makes exactly one Responses API call
 * and returns parsed JSON plus usage, or a safe failure code. Raw provider bodies
 * never leave this module.
 */
import type { Config } from '../env';
import type { TokenUsage } from '../pricing';
import { RESULT_SCHEMA } from './schema';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export type ModelFailureCode = 'model_error' | 'model_timeout' | 'invalid_model_response';

export type ModelCallResult =
  | { ok: true; data: unknown; usage: TokenUsage | null }
  | { ok: false; code: ModelFailureCode; message: string; usage: TokenUsage | null };

export interface ModelRequest {
  apiKey: string;
  config: Config;
  instructions: string;
  input: string;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function readUsage(body: Record<string, unknown>): TokenUsage | null {
  const usage = body.usage as Record<string, unknown> | undefined;
  if (!usage || typeof usage !== 'object') return null;
  const inputTokens = count(usage.input_tokens);
  const outputTokens = count(usage.output_tokens);
  const reportedTotal = count(usage.total_tokens);
  const inputDetails = usage.input_tokens_details as Record<string, unknown> | undefined;
  const outputDetails = usage.output_tokens_details as Record<string, unknown> | undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      reportedTotal ??
      (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null),
    cachedInputTokens: count(inputDetails?.cached_tokens),
    reasoningTokens: count(outputDetails?.reasoning_tokens),
  };
}

/** Pulls the assistant's text (or a refusal marker) out of a Responses API body. */
function readOutput(body: Record<string, unknown>): { text: string } | { refusal: true } | null {
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content as Array<Record<string, unknown>>) {
      if (part?.type === 'refusal') return { refusal: true };
      if (part?.type === 'output_text' && typeof part.text === 'string') return { text: part.text };
    }
  }
  return null;
}

export async function requestTranslation(request: ModelRequest): Promise<ModelCallResult> {
  const { apiKey, config } = request;
  const payload: Record<string, unknown> = {
    model: config.model,
    instructions: request.instructions,
    input: request.input,
    max_output_tokens: config.maxOutputTokens,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'turanslate_result',
        strict: true,
        schema: RESULT_SCHEMA,
      },
    },
  };
  if (config.reasoningEffort) payload.reasoning = { effort: config.reasoningEffort };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted = error instanceof Error && error.name === 'AbortError';
    return aborted
      ? {
          ok: false,
          code: 'model_timeout',
          message: `timeout_after_${config.timeoutMs}ms`,
          usage: null,
        }
      : { ok: false, code: 'model_error', message: 'provider_unreachable', usage: null };
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    clearTimeout(timer);
    const aborted = error instanceof Error && error.name === 'AbortError';
    return aborted
      ? {
          ok: false,
          code: 'model_timeout',
          message: `timeout_after_${config.timeoutMs}ms`,
          usage: null,
        }
      : {
          ok: false,
          code: 'model_error',
          message: `provider_http_${response.status}`,
          usage: null,
        };
  }
  clearTimeout(timer);

  if (!response.ok) {
    // Only the status code is kept; provider error bodies can echo request details.
    return {
      ok: false,
      code: 'model_error',
      message: `provider_http_${response.status}`,
      usage: null,
    };
  }

  const usage = readUsage(body);
  if (body.status !== 'completed') {
    const details = body.incomplete_details as Record<string, unknown> | undefined;
    const reason = typeof details?.reason === 'string' ? details.reason : String(body.status);
    return {
      ok: false,
      code: 'invalid_model_response',
      message: `response_${String(body.status)}:${reason}`.slice(0, 120),
      usage,
    };
  }

  const output = readOutput(body);
  if (!output) {
    return { ok: false, code: 'invalid_model_response', message: 'no_output_text', usage };
  }
  if ('refusal' in output) {
    return { ok: false, code: 'model_error', message: 'model_refusal', usage };
  }
  try {
    return { ok: true, data: JSON.parse(output.text), usage };
  } catch {
    return { ok: false, code: 'invalid_model_response', message: 'output_not_json', usage };
  }
}
