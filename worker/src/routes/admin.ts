import type {
  AdminLogDetail,
  AdminLogListItem,
  AdminLogListResponse,
  LogStatus,
  Role,
  TranslationResult,
  UsageSummaryResponse,
  UsageSummaryRow,
} from '../../../shared/api';
import type { SourceMode } from '../../../shared/languages';
import { normalizeUsername } from '../../../shared/username';
import { authenticate } from '../auth/sessions';
import type { Config, Env } from '../env';
import { ApiError, json } from '../http';

/** Every admin handler goes through this: valid session AND admin role. */
async function requireAdmin(request: Request, env: Env): Promise<void> {
  const session = await authenticate(request, env.DB, env.SESSION_SECRET);
  if (session.user.role !== 'admin') throw new ApiError(403, 'forbidden');
}

const PREVIEW_CHARS = 120;
const DEFAULT_PAGE = 25;
const MAX_PAGE = 100;

interface LogListRow {
  id: number;
  created_at: string;
  username: string;
  input_preview: string;
  source_mode: SourceMode;
  detected_source: string | null;
  model: string;
  status: LogStatus;
  total_tokens: number | null;
  estimated_total_cost_usd: number | null;
}

export async function handleListLogs(request: Request, env: Env): Promise<Response> {
  await requireAdmin(request, env);
  const params = new URL(request.url).searchParams;
  const limitParam = Number(params.get('limit') ?? DEFAULT_PAGE);
  const limit = Number.isInteger(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_PAGE)
    : DEFAULT_PAGE;
  const before = Number(params.get('before'));
  const username = params.get('username');

  const where: string[] = [];
  const binds: unknown[] = [];
  if (username) {
    where.push('username = ?');
    binds.push(normalizeUsername(username));
  }
  if (Number.isInteger(before) && before > 0) {
    where.push('id < ?');
    binds.push(before);
  }
  const { results } = await env.DB.prepare(
    `SELECT id, created_at, username, substr(input_text, 1, ${PREVIEW_CHARS}) AS input_preview,
            source_mode, detected_source, model, status, total_tokens, estimated_total_cost_usd
       FROM query_logs
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY id DESC
      LIMIT ?`,
  )
    .bind(...binds, limit + 1)
    .all<LogListRow>();

  const page = results.slice(0, limit);
  const items: AdminLogListItem[] = page.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    username: row.username,
    inputPreview: row.input_preview,
    sourceMode: row.source_mode,
    detectedSource: row.detected_source,
    model: row.model,
    status: row.status,
    totalTokens: row.total_tokens,
    estimatedTotalCostUsd: row.estimated_total_cost_usd,
  }));
  const response: AdminLogListResponse = {
    items,
    nextBefore: results.length > limit ? page[page.length - 1]!.id : null,
  };
  return json(response);
}

interface LogDetailRow {
  id: number;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  user_id: number;
  username: string;
  input_text: string;
  source_mode: SourceMode;
  detected_source: string | null;
  model: string;
  status: LogStatus;
  error_code: string | null;
  error_message: string | null;
  response_json: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cached_input_tokens: number | null;
  reasoning_tokens: number | null;
  estimated_input_cost_usd: number | null;
  estimated_output_cost_usd: number | null;
  estimated_total_cost_usd: number | null;
}

export async function handleLogDetail(request: Request, env: Env, id: number): Promise<Response> {
  await requireAdmin(request, env);
  const row = await env.DB.prepare('SELECT * FROM query_logs WHERE id = ?')
    .bind(id)
    .first<LogDetailRow>();
  if (!row) throw new ApiError(404, 'not_found');

  let parsed: TranslationResult | null = null;
  if (row.response_json) {
    try {
      parsed = JSON.parse(row.response_json) as TranslationResult;
    } catch {
      parsed = null;
    }
  }
  const detail: AdminLogDetail = {
    id: row.id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    userId: row.user_id,
    username: row.username,
    inputText: row.input_text,
    sourceMode: row.source_mode,
    detectedSource: row.detected_source,
    model: row.model,
    status: row.status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    response: parsed,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    cachedInputTokens: row.cached_input_tokens,
    reasoningTokens: row.reasoning_tokens,
    estimatedInputCostUsd: row.estimated_input_cost_usd,
    estimatedOutputCostUsd: row.estimated_output_cost_usd,
    estimatedTotalCostUsd: row.estimated_total_cost_usd,
  };
  return json(detail);
}

interface SummaryRow {
  user_id: number;
  username: string;
  role: Role;
  is_active: number;
  query_count: number;
  success_count: number;
  failure_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  last_query_at: string | null;
}

export async function handleUsageSummary(
  request: Request,
  env: Env,
  config: Config,
): Promise<Response> {
  await requireAdmin(request, env);
  const { results } = await env.DB.prepare(
    `SELECT u.id AS user_id, u.username, u.role, u.is_active,
            COUNT(q.id) AS query_count,
            COALESCE(SUM(q.status = 'success'), 0) AS success_count,
            COALESCE(SUM(q.status = 'failure'), 0) AS failure_count,
            COALESCE(SUM(q.input_tokens), 0) AS input_tokens,
            COALESCE(SUM(q.output_tokens), 0) AS output_tokens,
            COALESCE(SUM(q.total_tokens), 0) AS total_tokens,
            COALESCE(SUM(q.estimated_total_cost_usd), 0) AS estimated_cost_usd,
            MAX(q.created_at) AS last_query_at
       FROM users u LEFT JOIN query_logs q ON q.user_id = u.id
      GROUP BY u.id
      ORDER BY query_count DESC, u.username ASC`,
  ).all<SummaryRow>();

  const users: UsageSummaryRow[] = results.map((row) => ({
    userId: row.user_id,
    username: row.username,
    role: row.role,
    isActive: row.is_active === 1,
    queryCount: row.query_count,
    successCount: row.success_count,
    failureCount: row.failure_count,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    estimatedCostUsd: row.estimated_cost_usd,
    lastQueryAt: row.last_query_at,
  }));
  const totals = users.reduce(
    (sum, row) => ({
      queryCount: sum.queryCount + row.queryCount,
      successCount: sum.successCount + row.successCount,
      failureCount: sum.failureCount + row.failureCount,
      inputTokens: sum.inputTokens + row.inputTokens,
      outputTokens: sum.outputTokens + row.outputTokens,
      totalTokens: sum.totalTokens + row.totalTokens,
      estimatedCostUsd: sum.estimatedCostUsd + row.estimatedCostUsd,
    }),
    {
      queryCount: 0,
      successCount: 0,
      failureCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    },
  );
  const response: UsageSummaryResponse = {
    users,
    totals,
    pricingConfigured: config.pricing !== null,
  };
  return json(response);
}
