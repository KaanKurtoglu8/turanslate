// Fails the build if anything that looks like a secret ended up in the static bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const PATTERNS = [
  [/sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/, 'OpenAI-style API key'],
  [/OPENAI_API_KEY/, 'OPENAI_API_KEY reference'],
  [/SESSION_SECRET/, 'SESSION_SECRET reference'],
  [/pbkdf2_sha256\$/, 'password hash'],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let problems = 0;
for (const file of files(DIST)) {
  if (!/\.(js|html|css|json|map|txt)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const [pattern, label] of PATTERNS) {
    if (pattern.test(content)) {
      console.error(`check-dist-secrets: ${label} found in ${file}`);
      problems++;
    }
  }
}
if (problems) process.exit(1);
console.log('check-dist-secrets: no secrets found in dist/');
