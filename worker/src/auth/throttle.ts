/**
 * Bounded failed-login protection: after too many failures inside a window, the
 * username (or client IP) is locked for a short period.
 */

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export const USER_FAILURE_LIMIT = 5;
export const IP_FAILURE_LIMIT = 20;

export interface ThrottleKey {
  key: string;
  limit: number;
}

export function throttleKeys(username: string, ip: string): ThrottleKey[] {
  return [
    { key: `user:${username}`, limit: USER_FAILURE_LIMIT },
    { key: `ip:${ip}`, limit: IP_FAILURE_LIMIT },
  ];
}

export async function isLocked(db: D1Database, keys: ThrottleKey[], now: Date): Promise<boolean> {
  const placeholders = keys.map(() => '?').join(', ');
  const row = await db
    .prepare(
      `SELECT 1 AS locked FROM login_throttle
        WHERE key IN (${placeholders}) AND locked_until IS NOT NULL AND locked_until > ?
        LIMIT 1`,
    )
    .bind(...keys.map((k) => k.key), now.toISOString())
    .first();
  return row !== null;
}

export async function recordFailure(db: D1Database, keys: ThrottleKey[], now: Date): Promise<void> {
  const nowIso = now.toISOString();
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString();
  const lockedUntil = new Date(now.getTime() + LOCK_MS).toISOString();
  await db.batch(
    keys.map(({ key, limit }) =>
      db
        .prepare(
          `INSERT INTO login_throttle (key, failures, window_started_at, locked_until)
           VALUES (?1, 1, ?2, CASE WHEN 1 >= ?4 THEN ?5 ELSE NULL END)
           ON CONFLICT (key) DO UPDATE SET
             failures = CASE WHEN window_started_at < ?3 THEN 1 ELSE failures + 1 END,
             window_started_at = CASE WHEN window_started_at < ?3 THEN ?2 ELSE window_started_at END,
             locked_until = CASE
               WHEN (CASE WHEN window_started_at < ?3 THEN 1 ELSE failures + 1 END) >= ?4 THEN ?5
               ELSE locked_until END`,
        )
        .bind(key, nowIso, windowStart, limit, lockedUntil),
    ),
  );
}

export async function clearUserFailures(db: D1Database, username: string): Promise<void> {
  await db.prepare('DELETE FROM login_throttle WHERE key = ?').bind(`user:${username}`).run();
}
