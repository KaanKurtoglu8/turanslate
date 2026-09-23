# Turanslate

Compare one short sentence across eight Turkic languages, in a fixed order
(`tr → az → tk → uz → ug → ky → kk → tt`), plus an experimental **Ortak Türkçe / Shared Turkic** form.
`AGENTS.md` is the product and security spec.

```
/                 Vite + React + TypeScript frontend (static, GitHub Pages at /turanslate/)
├─ src/           UI: config/ (language metadata), i18n/, api/, auth/, components/
├─ shared/        Types and language ids shared by the frontend and the Worker
├─ flags/         Local flag SVGs (bundled by Vite)
└─ worker/        Cloudflare Worker API + D1 (auth, sessions, OpenAI, logging, admin)
   ├─ migrations/ D1 schema
   ├─ scripts/    seed-users.ts: sync users.seed.local.json into D1
   └─ test/       API tests (real SQL via node:sqlite, OpenAI mocked)
```

The browser never sees the OpenAI key. It only talks to the Worker, which checks the
session on every protected route and the admin role on every `/admin/*` route.

## Requirements

Node.js 24 or newer (the seed script runs TypeScript directly, and the tests use `node:sqlite`).

```bash
npm install
npm --prefix worker install
```

## Local development

1. Create the Worker's local secrets file:

   ```bash
   cp worker/.dev.vars.example worker/.dev.vars
   ```

   Then set `OPENAI_API_KEY` and a long random `SESSION_SECRET` in it (`openssl rand -base64 48`).

2. Create your local user list (gitignored) and edit the passwords:

   ```bash
   cp users.seed.example.json users.seed.local.json
   ```

3. Apply migrations and sync users into the local D1:

   ```bash
   npm run db:migrate:local
   npm run users:sync:local
   ```

4. Point the frontend at the local Worker and start both servers (two terminals):

   ```bash
   cp .env.local.example .env.local
   npm run worker:dev
   npm run dev
   ```

   Then open http://localhost:5173/turanslate/.

## Managing accounts

`users.seed.local.json` is the source of truth. It stays on your machine and is never committed.

```json
[
  { "username": "kurtoglu", "password": "…", "role": "admin" },
  { "username": "friend", "password": "…", "role": "user" },
  { "username": "old-friend", "password": "…", "role": "user", "active": false }
]
```

- `npm run users:sync:remote` pushes the file to production (`:local` for the dev DB).
  It hashes each password with PBKDF2-SHA256 and a unique salt; only the hash reaches D1.
- Accounts with `"active": false`, and accounts removed from the file, are deactivated.
  Their sessions are revoked, and their logs are kept.
- After changing passwords, sign everyone out:
  `npm --prefix worker run users:sync:remote -- --revoke-sessions`.
- Preview a sync without writing: `... -- --dry-run`.

## Checks

```bash
npm run check
```

This runs Prettier, ESLint, typechecks (frontend and Worker), Vitest, the production build
(including a scan of `dist/` for leaked secrets), and a Worker bundle dry run.

## First deployment

### 1. Cloudflare (backend)

```bash
cd worker
npx wrangler login
npx wrangler d1 create turanslate
```

- Copy the printed `database_id` into `worker/wrangler.toml`.
- Set the secrets:

  ```bash
  npx wrangler secret put OPENAI_API_KEY
  npx wrangler secret put SESSION_SECRET
  ```

- Apply the migrations, deploy, and sync users:

  ```bash
  npm run db:migrate:remote
  npm run deploy
  npm run users:sync:remote
  ```

`deploy` prints the Worker URL, e.g. `https://turanslate-api.<account>.workers.dev`.

In `wrangler.toml`, check `OPENAI_MODEL` and the two `OPENAI_*_USD_PER_1M` prices against
current OpenAI pricing. Production CORS allows only `https://kaankurtoglu8.github.io`.

### 2. GitHub (frontend)

1. Push this project to a repository named **`turanslate`** on the `kaankurtoglu8` account.
2. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Go to **Settings → Secrets and variables → Actions → Variables** and add the variable
   `VITE_API_BASE_URL` set to the Worker URL. It is public and must never contain a secret.
4. Push to `main`, or run the workflow manually. The site is published at
   https://kaankurtoglu8.github.io/turanslate/.

## Configuration reference (Worker)

| Name                                                   | Where  | Purpose                                          |
| ------------------------------------------------------ | ------ | ------------------------------------------------ |
| `OPENAI_API_KEY`                                       | secret | OpenAI key (server-side only)                    |
| `SESSION_SECRET`                                       | secret | HMAC key for stored session-token hashes         |
| `ALLOWED_ORIGINS`                                      | var    | Exact CORS origins (comma-separated)             |
| `OPENAI_MODEL`                                         | var    | Model id; one Responses API call per translation |
| `OPENAI_REASONING_EFFORT`                              | var    | Empty to omit (for non-reasoning models)         |
| `OPENAI_INPUT_USD_PER_1M` / `OPENAI_OUTPUT_USD_PER_1M` | var    | Cost estimates; leave empty to disable           |
| `OPENAI_MAX_OUTPUT_TOKENS`, `OPENAI_TIMEOUT_MS`        | var    | Model call limits                                |
| `SESSION_TTL_HOURS`                                    | var    | Session lifetime                                 |
