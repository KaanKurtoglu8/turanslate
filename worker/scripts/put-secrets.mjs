/**
 * Uploads the Worker's production secrets without ever printing them.
 *
 *   npm run secrets:put              # both secrets
 *   npm run secrets:put -- --openai  # only OPENAI_API_KEY (e.g. after rotating the key)
 *   npm run secrets:put -- --session # only a fresh SESSION_SECRET (signs everyone out)
 *
 * OPENAI_API_KEY is read from the gitignored worker/.dev.vars.
 * SESSION_SECRET is freshly generated; nobody needs to know its value.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const wantOpenAi = args.length === 0 || args.includes('--openai');
const wantSession = args.length === 0 || args.includes('--session');

function readDevVar(name) {
  const file = join(workerDir, '.dev.vars');
  if (!existsSync(file)) return null;
  const line = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(`${name}=`));
  const value = line
    ?.slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
  return value || null;
}

function put(name, value) {
  const wrangler = join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const result = spawnSync(process.execPath, [wrangler, 'secret', 'put', name], {
    cwd: workerDir,
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (result.status !== 0) {
    console.error(`put-secrets: failed to set ${name}`);
    process.exit(1);
  }
}

// Wrangler does not refresh an expired browser login when stdin is piped (as in `put`),
// so refresh it first with a plain command.
const wranglerBin = join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const whoami = spawnSync(process.execPath, [wranglerBin, 'whoami'], {
  cwd: workerDir,
  encoding: 'utf8',
});
if (!/logged in/i.test(`${whoami.stdout}${whoami.stderr}`)) {
  console.error('put-secrets: not logged in to Cloudflare. Run `npx wrangler login` in worker/.');
  process.exit(1);
}

if (wantOpenAi) {
  const key = readDevVar('OPENAI_API_KEY');
  if (!key || !key.startsWith('sk-')) {
    console.error('put-secrets: set OPENAI_API_KEY=sk-... in worker/.dev.vars first');
    process.exit(1);
  }
  console.log('Setting OPENAI_API_KEY from worker/.dev.vars …');
  put('OPENAI_API_KEY', key);
}

if (wantSession) {
  console.log('Setting a freshly generated SESSION_SECRET …');
  put('SESSION_SECRET', randomBytes(48).toString('base64url'));
}

console.log('Done. Values were not printed.');
