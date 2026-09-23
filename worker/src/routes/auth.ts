import type { LoginResponse, MeResponse, Role } from '../../../shared/api';
import { isValidUsername, normalizeUsername } from '../../../shared/username';
import { verifyAgainstDummy, verifyPassword } from '../auth/password';
import { authenticate, createSession, revokeSession } from '../auth/sessions';
import { clearUserFailures, isLocked, recordFailure, throttleKeys } from '../auth/throttle';
import type { Config, Env } from '../env';
import { ApiError, json, readJsonBody } from '../http';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  is_active: number;
}

const MAX_PASSWORD_CHARS = 256;

export async function handleLogin(request: Request, env: Env, config: Config): Promise<Response> {
  const body = await readJsonBody(request);
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    throw new ApiError(400, 'bad_request');
  }
  const username = normalizeUsername(body.username);
  const password = body.password;
  if (!isValidUsername(username) || password.length === 0 || password.length > MAX_PASSWORD_CHARS) {
    throw new ApiError(401, 'invalid_credentials');
  }

  const now = new Date();
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const keys = throttleKeys(username, ip);
  if (await isLocked(env.DB, keys, now)) throw new ApiError(429, 'rate_limited');

  const user = await env.DB.prepare(
    'SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?',
  )
    .bind(username)
    .first<UserRow>();

  const valid = user
    ? await verifyPassword(password, user.password_hash)
    : (await verifyAgainstDummy(password), false);

  if (!user || !valid) {
    await recordFailure(env.DB, keys, now);
    throw new ApiError(401, 'invalid_credentials');
  }
  // Only reported after a correct password, so it does not reveal which usernames exist.
  if (user.is_active !== 1) throw new ApiError(403, 'account_inactive');

  await clearUserFailures(env.DB, username);
  const session = await createSession(env.DB, env.SESSION_SECRET, user.id, config.sessionTtlMs);
  const response: LoginResponse = {
    token: session.token,
    expiresAt: session.expiresAt,
    user: { id: user.id, username: user.username, role: user.role },
  };
  return json(response);
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const session = await authenticate(request, env.DB, env.SESSION_SECRET);
  await revokeSession(env.DB, session.tokenHash);
  return json({ ok: true });
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await authenticate(request, env.DB, env.SESSION_SECRET);
  const response: MeResponse = { user: session.user, expiresAt: session.expiresAt };
  return json(response);
}
