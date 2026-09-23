import {
  MAX_INPUT_CHARS,
  type ErrorCode,
  type TranslateResponse,
  type TranslationResult,
} from '../../../shared/api';
import { isSourceMode, type SourceMode } from '../../../shared/languages';
import { authenticate } from '../auth/sessions';
import type { Config, Env } from '../env';
import { ApiError, json, nowIso, readJsonBody } from '../http';
import { estimateCost, type TokenUsage } from '../pricing';
import { requestTranslation } from '../translation/openai';
import { SYSTEM_PROMPT, buildUserMessage } from '../translation/prompt';
import { validateModelOutput } from '../translation/validate';

interface Completion {
  status: 'success' | 'failure';
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  detectedSource: string | null;
  result: TranslationResult | null;
  usage: TokenUsage | null;
}

async function completeLog(
  db: D1Database,
  logId: number,
  startedAt: number,
  config: Config,
  completion: Completion,
): Promise<void> {
  const cost = estimateCost(completion.usage, config.pricing);
  const usage = completion.usage;
  await db
    .prepare(
      `UPDATE query_logs SET
         status = ?, completed_at = ?, duration_ms = ?, detected_source = ?,
         error_code = ?, error_message = ?, response_json = ?,
         input_tokens = ?, output_tokens = ?, total_tokens = ?,
         cached_input_tokens = ?, reasoning_tokens = ?,
         input_price_usd_per_1m = ?, output_price_usd_per_1m = ?,
         estimated_input_cost_usd = ?, estimated_output_cost_usd = ?, estimated_total_cost_usd = ?
       WHERE id = ?`,
    )
    .bind(
      completion.status,
      nowIso(),
      Date.now() - startedAt,
      completion.detectedSource,
      completion.errorCode,
      completion.errorMessage,
      completion.result ? JSON.stringify(completion.result) : null,
      usage?.inputTokens ?? null,
      usage?.outputTokens ?? null,
      usage?.totalTokens ?? null,
      usage?.cachedInputTokens ?? null,
      usage?.reasoningTokens ?? null,
      config.pricing?.inputUsdPer1M ?? null,
      config.pricing?.outputUsdPer1M ?? null,
      cost.inputUsd,
      cost.outputUsd,
      cost.totalUsd,
      logId,
    )
    .run();
}

const FAILURE_STATUS: Record<string, number> = {
  model_error: 502,
  model_timeout: 504,
  invalid_model_response: 502,
  server_misconfigured: 503,
};

export async function handleTranslate(
  request: Request,
  env: Env,
  config: Config,
): Promise<Response> {
  const { user } = await authenticate(request, env.DB, env.SESSION_SECRET);
  const body = await readJsonBody(request);

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new ApiError(400, 'empty_input');
  if ([...text].length > MAX_INPUT_CHARS) throw new ApiError(400, 'input_too_long');
  const source: SourceMode = body.source === undefined ? 'auto' : (body.source as SourceMode);
  if (!isSourceMode(source)) throw new ApiError(400, 'invalid_source');

  // The log row exists before any paid call, so every model request is accounted for.
  const startedAt = Date.now();
  const inserted = await env.DB.prepare(
    `INSERT INTO query_logs (user_id, username, created_at, input_text, source_mode, model, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending') RETURNING id`,
  )
    .bind(user.id, user.username, new Date(startedAt).toISOString(), text, source, config.model)
    .first<{ id: number }>();
  if (!inserted) throw new ApiError(503, 'database_error');
  const logId = inserted.id;

  const fail = async (code: ErrorCode, message: string, extra: Partial<Completion> = {}) => {
    await completeLog(env.DB, logId, startedAt, config, {
      status: 'failure',
      errorCode: code,
      errorMessage: message,
      detectedSource: null,
      result: null,
      usage: null,
      ...extra,
    });
    throw new ApiError(FAILURE_STATUS[code] ?? 500, code);
  };

  if (!env.OPENAI_API_KEY) return fail('server_misconfigured', 'openai_api_key_missing');

  const call = await requestTranslation({
    apiKey: env.OPENAI_API_KEY,
    config,
    instructions: SYSTEM_PROMPT,
    input: buildUserMessage(text, source),
  });
  if (!call.ok) return fail(call.code, call.message, { usage: call.usage });

  const validation = validateModelOutput(call.data, source);
  if (!validation.ok) {
    return fail('invalid_model_response', `validation:${validation.reason}`, {
      usage: call.usage,
      detectedSource: validation.modelDetectedSource,
    });
  }

  await completeLog(env.DB, logId, startedAt, config, {
    status: 'success',
    errorCode: null,
    errorMessage: null,
    detectedSource: validation.modelDetectedSource,
    result: validation.result,
    usage: call.usage,
  });

  const response: TranslateResponse = { logId, sourceMode: source, result: validation.result };
  return json(response);
}
