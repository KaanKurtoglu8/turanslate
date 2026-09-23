/**
 * Synchronizes the owner's local, gitignored `users.seed.local.json` into D1.
 *
 *   node scripts/seed-users.ts --local            # local D1 used by `wrangler dev`
 *   node scripts/seed-users.ts --remote           # production D1
 *   options: --file <path>  --dry-run  --revoke-sessions
 *
 * - Usernames are normalized exactly like the login route does.
 * - Each password gets a fresh random salt; only the PBKDF2 hash reaches D1.
 * - Accounts in the file with `"active": false`, and accounts missing from the file,
 *   are deactivated (not deleted, so their query logs keep a valid owner) and their
 *   sessions are revoked.
 * - `--revoke-sessions` also signs out every active user (e.g. after password changes).
 *
 * The SQL (which contains hashes, never plaintext) is written to a private temp file
 * and deleted right after wrangler runs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/auth/password.ts';
import { isValidUsername, normalizeUsername } from '../../shared/username.ts';

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(workerDir, '..');

interface SeedUser {
  username: string;
  password: string;
  role: 'admin' | 'user';
  active: boolean;
}

class SeedError extends Error {}

function fail(message: string): never {
  throw new SeedError(message);
}

function parseArgs(argv: string[]) {
  const args = {
    target: '',
    file: join(repoRoot, 'users.seed.local.json'),
    dryRun: false,
    revokeAll: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--local' || arg === '--remote') args.target = arg;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--revoke-sessions') args.revokeAll = true;
    else if (arg === '--file') args.file = resolve(argv[++i] ?? fail('--file needs a path'));
    else fail(`unknown argument ${arg}`);
  }
  if (!args.target) fail('pass --local or --remote');
  return args;
}

/** Passwords from the committed example file, which must never be synced. */
function examplePasswords(): Set<string> {
  try {
    const example = JSON.parse(readFileSync(join(repoRoot, 'users.seed.example.json'), 'utf8'));
    return new Set(
      (Array.isArray(example) ? example : [])
        .map((entry: { password?: unknown }) => entry?.password)
        .filter((password: unknown): password is string => typeof password === 'string'),
    );
  } catch {
    return new Set();
  }
}

function loadSeed(path: string): SeedUser[] {
  if (!existsSync(path)) {
    fail(`${path} not found. Copy users.seed.example.json to users.seed.local.json and edit it.`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(`${path} is not valid JSON`);
  }
  if (!Array.isArray(raw)) fail('seed file must be a JSON array');

  const placeholders = examplePasswords();
  const seen = new Set<string>();
  return raw.map((entry: unknown, index: number): SeedUser => {
    const where = `entry ${index}`;
    if (typeof entry !== 'object' || entry === null) fail(`${where} is not an object`);
    const { username, password, role, active } = entry as Record<string, unknown>;
    if (typeof username !== 'string') fail(`${where}: username must be a string`);
    const normalized = normalizeUsername(username);
    if (!isValidUsername(normalized)) {
      fail(`${where}: username must be 2-64 letters, digits, ".", "_" or "-"`);
    }
    if (seen.has(normalized)) fail(`${where}: duplicate username "${normalized}"`);
    seen.add(normalized);
    if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
      fail(`${where} (${normalized}): password must be 8-256 characters`);
    }
    // The example file is public; its placeholder passwords must never become real ones.
    if (placeholders.has(password)) {
      fail(`${where} (${normalized}): still has a placeholder password; set a real one`);
    }
    if (role !== 'admin' && role !== 'user')
      fail(`${where} (${normalized}): role must be "admin" or "user"`);
    if (active !== undefined && typeof active !== 'boolean') {
      fail(`${where} (${normalized}): active must be true or false`);
    }
    return { username: normalized, password, role, active: active !== false };
  });
}

const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;

async function buildSql(users: SeedUser[], revokeAll: boolean): Promise<string> {
  const now = new Date().toISOString();
  const statements: string[] = [];
  for (const user of users) {
    const hash = await hashPassword(user.password);
    statements.push(
      `INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at)
VALUES (${sql(user.username)}, ${sql(hash)}, ${sql(user.role)}, ${user.active ? 1 : 0}, ${sql(now)}, ${sql(now)})
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role,
  is_active = excluded.is_active, updated_at = excluded.updated_at;`,
    );
  }
  const listed = users.map((u) => sql(u.username)).join(', ');
  statements.push(
    `UPDATE users SET is_active = 0, updated_at = ${sql(now)} WHERE is_active = 1 AND username NOT IN (${listed});`,
    `UPDATE sessions SET revoked_at = ${sql(now)} WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE is_active = 0);`,
  );
  if (revokeAll)
    statements.push(`UPDATE sessions SET revoked_at = ${sql(now)} WHERE revoked_at IS NULL;`);
  return statements.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const users = loadSeed(args.file);
  if (users.length === 0) fail('seed file is empty; refusing to deactivate every account');
  if (!users.some((u) => u.role === 'admin' && u.active)) {
    console.warn('seed-users: warning: no active admin account in the seed file');
  }

  console.log(
    `Syncing ${users.length} account(s) to ${args.target === '--local' ? 'LOCAL' : 'REMOTE'} D1:`,
  );
  for (const user of users) {
    console.log(
      `  ${user.active ? 'active  ' : 'inactive'}  ${user.role.padEnd(5)}  ${user.username}`,
    );
  }
  console.log('  Accounts not listed above will be deactivated.');
  if (args.revokeAll) console.log('  All existing sessions will be revoked.');
  if (args.dryRun) {
    console.log('Dry run: nothing written.');
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'turanslate-seed-'));
  const sqlFile = join(tempDir, 'seed.sql');
  try {
    writeFileSync(sqlFile, await buildSql(users, args.revokeAll), { mode: 0o600 });
    const wrangler = join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    const result = spawnSync(
      process.execPath,
      [wrangler, 'd1', 'execute', 'DB', args.target, '--file', sqlFile, '--yes'],
      { cwd: workerDir, stdio: 'inherit' },
    );
    if (result.status !== 0) fail('wrangler d1 execute failed (did you apply migrations first?)');
    console.log('Done.');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  if (!(error instanceof SeedError)) throw error;
  console.error(`seed-users: ${error.message}`);
  process.exitCode = 1;
}
