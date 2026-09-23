/**
 * Thin client for the Turanslate Worker. The browser never talks to OpenAI;
 * it only sends the session token to our own backend.
 */
import type {
  AdminLogDetail,
  AdminLogListResponse,
  ApiErrorBody,
  LoginResponse,
  MeResponse,
  TranslateRequest,
  TranslateResponse,
  UsageSummaryResponse,
} from '../../shared/api';
import { ERROR_CODES } from '../../shared/api';
import type { ClientErrorCode } from '../i18n/dictionaries';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

const DEFAULT_TIMEOUT_MS = 20_000;
const TRANSLATE_TIMEOUT_MS = 90_000;

export class ApiClientError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
  ) {
    super(code);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  token?: string;
  body?: unknown;
  timeoutMs?: number;
}

function errorCodeOf(body: unknown): ClientErrorCode {
  const code = (body as Partial<ApiErrorBody> | null)?.error?.code;
  return (ERROR_CODES as readonly string[]).includes(code ?? '') ? code! : 'internal_error';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE) throw new ApiClientError('api_not_configured', 0);
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      credentials: 'omit',
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    throw new ApiClientError(aborted ? 'timeout' : 'network_error', 0);
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiClientError(errorCodeOf(body), response.status);
  return body as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { username, password } }),
  logout: (token: string) => request<{ ok: true }>('/auth/logout', { method: 'POST', token }),
  me: (token: string) => request<MeResponse>('/auth/me', { token }),
  translate: (token: string, body: TranslateRequest) =>
    request<TranslateResponse>('/translate', {
      method: 'POST',
      token,
      body,
      timeoutMs: TRANSLATE_TIMEOUT_MS,
    }),
  adminLogs: (token: string, params: { username?: string; before?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.username) query.set('username', params.username);
    if (params.before) query.set('before', String(params.before));
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.size ? `?${query}` : '';
    return request<AdminLogListResponse>(`/admin/logs${suffix}`, { token });
  },
  adminLog: (token: string, id: number) => request<AdminLogDetail>(`/admin/logs/${id}`, { token }),
  usageSummary: (token: string) => request<UsageSummaryResponse>('/admin/usage-summary', { token }),
};
