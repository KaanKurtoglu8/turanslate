/**
 * Username normalization used by both the login route and the seed script.
 * Self-contained (no imports) so the Node seed script can import it directly.
 */

const USERNAME_PATTERN = /^[\p{L}\p{N}._-]{2,64}$/u;

export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

export function isValidUsername(normalized: string): boolean {
  return USERNAME_PATTERN.test(normalized);
}
