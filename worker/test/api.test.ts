/**
 * End-to-end tests of the Worker fetch handler against real migrations (via node:sqlite)
 * with the OpenAI HTTP call mocked. Covers the auth and authorization boundaries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AdminLogDetail,
  AdminLogListResponse,
  LoginResponse,
  TranslateResponse,
  UsageSummaryResponse,
} from '../../shared/api';
import { MAX_INPUT_CHARS } from '../../shared/api';
import { hashPassword } from '../src/auth/password';
import type { Env } from '../src/env';
import worker from '../src/index';
import { D1Shim } from './d1-shim';
import { openAiBody, sampleResult } from './fixtures';

const ORIGIN = 'https://kaankurtoglu8.github.io';
const API_KEY = 'sk-test-DO-NOT-LEAK-0123456789';

let db: D1Shim;
let env: Env;
let openAi: ReturnType<typeof vi.fn>;

async function addUser(username: string, password: string, role: 'admin' | 'user', active = 1) {
  const now = new Date().toISOString();
  db.sqlite
    .prepare(
      'INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(username, await hashPassword(password), role, active, now, now);
}

interface CallOptions {
  method?: string;
  token?: string;
  body?: unknown;
  origin?: string | null;
  ip?: string;
}

async function call(path: string, options: CallOptions = {}) {
  const headers = new Headers();
  if (options.origin !== null) headers.set('Origin', options.origin ?? ORIGIN);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  headers.set('CF-Connecting-IP', options.ip ?? '203.0.113.7');
  const response = await worker.fetch(
    new Request(`https://api.example.test${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    env,
  );
  const text = await response.text();
  return { response, status: response.status, text, json: text ? JSON.parse(text) : null };
}

async function login(username: string, password: string): Promise<string> {
  const { status, json } = await call('/auth/login', { body: { username, password } });
  expect(status).toBe(200);
  return (json as LoginResponse).token;
}

function mockModel(payload: unknown, usage?: { input: number; output: number }) {
  openAi.mockImplementation(async () => new Response(JSON.stringify(openAiBody(payload, usage))));
}

beforeEach(async () => {
  db = new D1Shim();
  env = {
    DB: db.asD1(),
    OPENAI_API_KEY: API_KEY,
    SESSION_SECRET: 'test-session-secret-0123456789',
    ALLOWED_ORIGINS: ORIGIN,
    OPENAI_MODEL: 'test-model',
    OPENAI_REASONING_EFFORT: 'low',
    OPENAI_INPUT_USD_PER_1M: '2',
    OPENAI_OUTPUT_USD_PER_1M: '10',
  };
  openAi = vi.fn();
  vi.stubGlobal('fetch', openAi);
  await addUser('kurtoglu', 'admin-password-1', 'admin');
  await addUser('friend', 'friend-password-1', 'user');
  await addUser('gone', 'gone-password-1', 'user', 0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authentication', () => {
  it('rejects every protected route without a session', async () => {
    for (const [path, method] of [
      ['/auth/me', 'GET'],
      ['/auth/logout', 'POST'],
      ['/translate', 'POST'],
      ['/admin/logs', 'GET'],
      ['/admin/logs/1', 'GET'],
      ['/admin/usage-summary', 'GET'],
    ] as const) {
      const { status, json } = await call(path, { method });
      expect(status, path).toBe(401);
      expect(json).toEqual({ error: { code: 'unauthorized' } });
    }
    const forged = await call('/translate', { token: 'x'.repeat(43), body: { text: 'Merhaba' } });
    expect(forged.status).toBe(401);
    expect(openAi).not.toHaveBeenCalled();
  });

  it('uses one generic error for unknown users and wrong passwords', async () => {
    const unknown = await call('/auth/login', {
      body: { username: 'nobody', password: 'whatever-1' },
    });
    const wrong = await call('/auth/login', {
      body: { username: 'friend', password: 'nope-nope-1' },
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.json).toEqual(wrong.json);
    expect(wrong.json).toEqual({ error: { code: 'invalid_credentials' } });
  });

  it('logs in with a normalized username and returns only safe fields', async () => {
    const { status, json, text } = await call('/auth/login', {
      body: { username: '  Friend ', password: 'friend-password-1' },
    });
    expect(status).toBe(200);
    expect(json.user).toEqual({ id: 2, username: 'friend', role: 'user' });
    expect(text).not.toContain('pbkdf2');
    const me = await call('/auth/me', { token: json.token });
    expect(me.status).toBe(200);
    expect(me.json.user.username).toBe('friend');
  });

  it('stores only a hash of the session token', async () => {
    const token = await login('friend', 'friend-password-1');
    const rows = db.sqlite.prepare('SELECT token_hash FROM sessions').all() as {
      token_hash: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toBe(token);
  });

  it('reports inactive accounts only after a correct password', async () => {
    const correct = await call('/auth/login', {
      body: { username: 'gone', password: 'gone-password-1' },
    });
    expect(correct.status).toBe(403);
    expect(correct.json.error.code).toBe('account_inactive');
    const wrong = await call('/auth/login', {
      body: { username: 'gone', password: 'bad-password' },
    });
    expect(wrong.json.error.code).toBe('invalid_credentials');
  });

  it('revokes the session on logout', async () => {
    const token = await login('friend', 'friend-password-1');
    expect((await call('/auth/logout', { method: 'POST', token })).status).toBe(200);
    expect((await call('/auth/me', { token })).status).toBe(401);
  });

  it('rejects expired sessions and sessions of deactivated users', async () => {
    const token = await login('friend', 'friend-password-1');
    db.sqlite.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await call('/auth/me', { token })).status).toBe(401);

    const token2 = await login('friend', 'friend-password-1');
    db.sqlite.prepare("UPDATE users SET is_active = 0 WHERE username = 'friend'").run();
    expect((await call('/auth/me', { token: token2 })).status).toBe(401);
  });

  it('locks a username after repeated failures, even for the right password', async () => {
    for (let i = 0; i < 5; i++) {
      const { status } = await call('/auth/login', {
        body: { username: 'friend', password: `wrong-${i}-password` },
      });
      expect(status).toBe(401);
    }
    const locked = await call('/auth/login', {
      body: { username: 'friend', password: 'friend-password-1' },
    });
    expect(locked.status).toBe(429);
    expect(locked.json.error.code).toBe('rate_limited');
    // Other accounts from another IP are unaffected.
    const other = await call('/auth/login', {
      body: { username: 'kurtoglu', password: 'admin-password-1' },
      ip: '198.51.100.1',
    });
    expect(other.status).toBe(200);
  });
});

describe('CORS', () => {
  it('echoes only the allowed origin', async () => {
    const allowed = await call('/auth/login', {
      body: { username: 'friend', password: 'friend-password-1' },
    });
    expect(allowed.response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);

    const evil = await call('/auth/login', {
      body: { username: 'friend', password: 'friend-password-1' },
      origin: 'https://evil.example',
    });
    expect(evil.status).toBe(403);
    expect(evil.response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers preflight requests for the allowed origin', async () => {
    const { status, response } = await call('/translate', { method: 'OPTIONS' });
    expect(status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
  });
});

describe('translation', () => {
  it('makes exactly one model call, validates, and logs the full result with costs', async () => {
    const token = await login('friend', 'friend-password-1');
    mockModel(sampleResult('kk'));

    const { status, json, text } = await call('/translate', {
      token,
      body: { text: '  Бүгін ауа райы өте жақсы.  ', source: 'auto' },
    });
    expect(status).toBe(200);
    const response = json as TranslateResponse;
    expect(response.result).toEqual(sampleResult('kk'));
    expect(response.sourceMode).toBe('auto');
    expect(text).not.toContain(API_KEY);

    expect(openAi).toHaveBeenCalledTimes(1);
    const [url, init] = openAi.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('test-model');
    expect(sent.store).toBe(false);
    expect(sent.reasoning).toEqual({ effort: 'low' });
    expect(sent.text.format.type).toBe('json_schema');
    expect(sent.text.format.strict).toBe(true);
    expect(JSON.parse(sent.input)).toEqual({ source: 'auto', text: 'Бүгін ауа райы өте жақсы.' });

    const log = db.sqlite.prepare('SELECT * FROM query_logs').get() as Record<string, unknown>;
    expect(log).toMatchObject({
      user_id: 2,
      username: 'friend',
      input_text: 'Бүгін ауа райы өте жақсы.',
      source_mode: 'auto',
      detected_source: 'kk',
      model: 'test-model',
      status: 'success',
      input_tokens: 1000,
      output_tokens: 500,
      total_tokens: 1500,
      reasoning_tokens: 120,
    });
    expect(log.estimated_input_cost_usd).toBeCloseTo(0.002, 10);
    expect(log.estimated_output_cost_usd).toBeCloseTo(0.005, 10);
    expect(log.estimated_total_cost_usd).toBeCloseTo(0.007, 10);
    expect(JSON.parse(log.response_json as string)).toEqual(response.result);
    expect(JSON.stringify(log)).not.toContain(API_KEY);
    expect(JSON.stringify(log)).not.toContain(token);
  });

  it('keeps an explicit source even if the model echoes another', async () => {
    const token = await login('friend', 'friend-password-1');
    mockModel(sampleResult('tr'));
    const { json } = await call('/translate', {
      token,
      body: { text: 'Salam', source: 'az-south' },
    });
    expect(json.result.detectedSource).toBe('az-south');
    const log = db.sqlite.prepare('SELECT detected_source FROM query_logs').get() as {
      detected_source: string;
    };
    expect(log.detected_source).toBe('tr');
  });

  it('rejects empty, oversized and invalid-source input without calling the model', async () => {
    const token = await login('friend', 'friend-password-1');
    expect((await call('/translate', { token, body: { text: '   ' } })).json.error.code).toBe(
      'empty_input',
    );
    const tooLong = await call('/translate', {
      token,
      body: { text: 'ж'.repeat(MAX_INPUT_CHARS + 1) },
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.json.error.code).toBe('input_too_long');
    expect(
      (await call('/translate', { token, body: { text: 'Merhaba', source: 'crh' } })).json.error
        .code,
    ).toBe('invalid_source');
    expect(openAi).not.toHaveBeenCalled();
    // Rejected input never reaches the log either.
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM query_logs').get()).toEqual({ n: 0 });
  });

  it('accepts exactly the maximum length, counted in characters after trimming', async () => {
    const token = await login('friend', 'friend-password-1');
    mockModel(sampleResult('kk'));
    // Multi-byte Cyrillic and surrounding whitespace must not count against the limit.
    const text = `  ${'ж'.repeat(MAX_INPUT_CHARS)}  `;
    const { status } = await call('/translate', { token, body: { text } });
    expect(status).toBe(200);
    expect(openAi).toHaveBeenCalledTimes(1);
  });

  it('fails safely and logs usage when the model output is incomplete', async () => {
    const token = await login('friend', 'friend-password-1');
    const broken = sampleResult('kk') as unknown as { translations: { kk: { native?: string } } };
    delete broken.translations.kk.native;
    mockModel(broken, { input: 900, output: 300 });

    const { status, json } = await call('/translate', { token, body: { text: 'Сәлем' } });
    expect(status).toBe(502);
    expect(json).toEqual({ error: { code: 'invalid_model_response' } });
    const log = db.sqlite.prepare('SELECT * FROM query_logs').get() as Record<string, unknown>;
    expect(log).toMatchObject({
      status: 'failure',
      error_code: 'invalid_model_response',
      error_message: 'validation:missing_native_kk',
      response_json: null,
      input_tokens: 900,
      output_tokens: 300,
    });
  });

  it('hides provider errors behind a safe code', async () => {
    const token = await login('friend', 'friend-password-1');
    openAi.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { message: `bad key ${API_KEY}` } }), { status: 401 }),
    );
    const { status, text } = await call('/translate', { token, body: { text: 'Merhaba' } });
    expect(status).toBe(502);
    expect(text).not.toContain(API_KEY);
    const log = db.sqlite.prepare('SELECT error_message FROM query_logs').get() as {
      error_message: string;
    };
    expect(log.error_message).toBe('provider_http_401');
  });

  it('times out slow model calls', async () => {
    env.OPENAI_TIMEOUT_MS = '30';
    const token = await login('friend', 'friend-password-1');
    openAi.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const { status, json } = await call('/translate', { token, body: { text: 'Merhaba' } });
    expect(status).toBe(504);
    expect(json.error.code).toBe('model_timeout');
  });

  it('logs a failure when the OpenAI key is missing', async () => {
    delete env.OPENAI_API_KEY;
    const token = await login('friend', 'friend-password-1');
    const { status, json } = await call('/translate', { token, body: { text: 'Merhaba' } });
    expect(status).toBe(503);
    expect(json.error.code).toBe('server_misconfigured');
    expect(openAi).not.toHaveBeenCalled();
    const log = db.sqlite.prepare('SELECT status FROM query_logs').get() as { status: string };
    expect(log.status).toBe('failure');
  });
});

describe('admin authorization', () => {
  it('forbids normal users from every admin route', async () => {
    const token = await login('friend', 'friend-password-1');
    for (const path of ['/admin/logs', '/admin/logs/1', '/admin/usage-summary']) {
      const { status, json } = await call(path, { token });
      expect(status, path).toBe(403);
      expect(json).toEqual({ error: { code: 'forbidden' } });
    }
  });

  it('lets the admin list, filter, page and inspect logs and usage', async () => {
    const friend = await login('friend', 'friend-password-1');
    const admin = await login('kurtoglu', 'admin-password-1');
    mockModel(sampleResult('kk'));
    for (let i = 0; i < 3; i++) {
      await call('/translate', { token: friend, body: { text: `Sentence ${i}` } });
    }
    await call('/translate', { token: admin, body: { text: 'Admin sentence', source: 'tr' } });

    const all = (await call('/admin/logs?limit=2', { token: admin })).json as AdminLogListResponse;
    expect(all.items.map((item) => item.inputPreview)).toEqual(['Admin sentence', 'Sentence 2']);
    expect(all.nextBefore).not.toBeNull();
    const next = (await call(`/admin/logs?limit=2&before=${all.nextBefore}`, { token: admin }))
      .json as AdminLogListResponse;
    expect(next.items.map((item) => item.inputPreview)).toEqual(['Sentence 1', 'Sentence 0']);
    expect(next.nextBefore).toBeNull();

    const filtered = (await call('/admin/logs?username=Friend', { token: admin }))
      .json as AdminLogListResponse;
    expect(filtered.items).toHaveLength(3);
    expect(filtered.items.every((item) => item.username === 'friend')).toBe(true);
    expect(filtered.items[0]).toMatchObject({ totalTokens: 1500, status: 'success' });
    expect(filtered.items[0]!.estimatedTotalCostUsd).toBeCloseTo(0.007, 10);

    const detail = (await call(`/admin/logs/${filtered.items[0]!.id}`, { token: admin }))
      .json as AdminLogDetail;
    expect(detail).toMatchObject({
      username: 'friend',
      inputText: 'Sentence 2',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    });
    expect(detail.response).toEqual(sampleResult('kk'));

    const summary = (await call('/admin/usage-summary', { token: admin }))
      .json as UsageSummaryResponse;
    const friendRow = summary.users.find((row) => row.username === 'friend')!;
    expect(friendRow).toMatchObject({
      queryCount: 3,
      successCount: 3,
      inputTokens: 3000,
      outputTokens: 1500,
      totalTokens: 4500,
    });
    expect(friendRow.estimatedCostUsd).toBeCloseTo(0.021, 10);
    expect(summary.totals.queryCount).toBe(4);
    expect(summary.pricingConfigured).toBe(true);

    expect((await call('/admin/logs/9999', { token: admin })).status).toBe(404);
  });
});
