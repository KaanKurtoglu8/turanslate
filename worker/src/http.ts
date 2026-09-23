import type { ApiErrorBody, ErrorCode } from '../../shared/api';

/** An error that is safe to send to the browser as `{ error: { code } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
  ) {
    super(code);
  }
}

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: BASE_HEADERS });
}

export function errorResponse(status: number, code: ErrorCode): Response {
  const body: ApiErrorBody = { error: { code } };
  return json(body, status);
}

const MAX_BODY_BYTES = 16 * 1024;

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) throw new ApiError(413, 'bad_request');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError(413, 'bad_request');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'bad_request');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(400, 'bad_request');
  }
  return parsed as Record<string, unknown>;
}

/** CORS for exact allow-listed origins only; never `*`. */
export function corsHeaders(origin: string | null, allowedOrigins: string[]): Headers | null {
  if (!origin || !allowedOrigins.includes(origin)) return null;
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  });
}

export function withHeaders(response: Response, extra: Headers | null): Response {
  if (!extra) return response;
  const merged = new Response(response.body, response);
  extra.forEach((value, key) => merged.headers.set(key, value));
  return merged;
}

export function nowIso(): string {
  return new Date().toISOString();
}
