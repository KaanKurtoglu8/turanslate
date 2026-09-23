/** Request/response shapes of the Worker API, shared with the frontend. */
import type { LanguageId, NativeLineLanguageId, SourceId, SourceMode } from './languages';

export type Role = 'admin' | 'user';

export interface SessionUser {
  id: number;
  username: string;
  role: Role;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

export interface MeResponse {
  user: SessionUser;
  expiresAt: string;
}

export interface LatinLine {
  latin: string;
}

export interface LatinNativeLine {
  latin: string;
  native: string;
}

export type TranslationSet = {
  [K in LanguageId]: K extends NativeLineLanguageId ? LatinNativeLine : LatinLine;
};

/** The validated model output; also exactly what is stored in `response_json`. */
export interface TranslationResult {
  detectedSource: SourceId;
  translations: TranslationSet;
  common: LatinLine;
}

/**
 * Maximum sentence length in Unicode code points, after trimming. The single source of
 * truth for both the Worker (which enforces it) and the input box (which mirrors it).
 */
export const MAX_INPUT_CHARS = 400;

export interface TranslateRequest {
  text: string;
  source: SourceMode;
}

export interface TranslateResponse {
  logId: number;
  sourceMode: SourceMode;
  result: TranslationResult;
}

export const ERROR_CODES = [
  'bad_request',
  'invalid_credentials',
  'account_inactive',
  'rate_limited',
  'unauthorized',
  'forbidden',
  'not_found',
  'empty_input',
  'input_too_long',
  'invalid_source',
  'model_error',
  'model_timeout',
  'invalid_model_response',
  'database_error',
  'server_misconfigured',
  'internal_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ErrorCode };
}

export type LogStatus = 'pending' | 'success' | 'failure';

export interface AdminLogListItem {
  id: number;
  createdAt: string;
  username: string;
  inputPreview: string;
  sourceMode: SourceMode;
  detectedSource: string | null;
  model: string;
  status: LogStatus;
  totalTokens: number | null;
  estimatedTotalCostUsd: number | null;
}

export interface AdminLogListResponse {
  items: AdminLogListItem[];
  /** Pass as `before` to fetch the next (older) page; null when exhausted. */
  nextBefore: number | null;
}

export interface AdminLogDetail {
  id: number;
  createdAt: string;
  completedAt: string | null;
  durationMs: number | null;
  userId: number;
  username: string;
  inputText: string;
  sourceMode: SourceMode;
  detectedSource: string | null;
  model: string;
  status: LogStatus;
  errorCode: string | null;
  errorMessage: string | null;
  response: TranslationResult | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  estimatedInputCostUsd: number | null;
  estimatedOutputCostUsd: number | null;
  estimatedTotalCostUsd: number | null;
}

export interface UsageSummaryRow {
  userId: number;
  username: string;
  role: Role;
  isActive: boolean;
  queryCount: number;
  successCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  lastQueryAt: string | null;
}

export interface UsageSummaryResponse {
  users: UsageSummaryRow[];
  totals: Omit<UsageSummaryRow, 'userId' | 'username' | 'role' | 'isActive' | 'lastQueryAt'>;
  pricingConfigured: boolean;
}
