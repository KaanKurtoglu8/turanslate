/**
 * Opaque bearer-token sessions. The browser holds a random token; D1 stores only an
 * HMAC of it, so a database leak does not yield usable tokens.
 */
import type { Role, SessionUser } from '../../../shared/api';
import { ApiError, nowIso } from '../http';

const TOKEN_BYTES = 32;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashToken(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  return base64Url(new Uint8Array(mac));
}

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 16) throw new ApiError(503, 'server_misconfigured');
  return secret;
}

export interface CreatedSession {
  token: string;
  expiresAt: string;
}

export async function createSession(
  db: D1Database,
  secret: string | undefined,
  userId: number,
  ttlMs: number,
): Promise<CreatedSession> {
  const key = requireSecret(secret);
  const token = base64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  await db.batch([
    // Opportunistic cleanup of long-dead sessions keeps the table small.
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now.toISOString()),
    db
      .prepare(
        'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .bind(await hashToken(token, key), userId, now.toISOString(), expiresAt),
  ]);
  return { token, expiresAt };
}

export interface AuthenticatedSession {
  user: SessionUser;
  tokenHash: string;
  expiresAt: string;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header.trim());
  return match ? match[1]! : null;
}

interface SessionRow {
  user_id: number;
  username: string;
  role: Role;
  expires_at: string;
}

/** Throws 401 unless the request carries a live session for an active user. */
export async function authenticate(
  request: Request,
  db: D1Database,
  secret: string | undefined,
): Promise<AuthenticatedSession> {
  const token = bearerToken(request);
  if (!token) throw new ApiError(401, 'unauthorized');
  const tokenHash = await hashToken(token, requireSecret(secret));
  const row = await db
    .prepare(
      `SELECT s.user_id, u.username, u.role, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.is_active = 1`,
    )
    .bind(tokenHash, nowIso())
    .first<SessionRow>();
  if (!row) throw new ApiError(401, 'unauthorized');
  return {
    user: { id: row.user_id, username: row.username, role: row.role },
    tokenHash,
    expiresAt: row.expires_at,
  };
}

export async function revokeSession(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(nowIso(), tokenHash)
    .run();
}
