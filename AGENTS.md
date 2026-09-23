# Turanslate AGENTS.md

## 1. Product purpose

Turanslate is a small, private, comparison-focused web app for Turkic languages.

A signed-in user enters a short sentence in one supported Turkic language. The app detects or accepts the source language, makes exactly one LLM request, translates the sentence into eight fixed natural languages, and displays the results vertically in a fixed order so lexical, phonological, and grammatical transitions are easy to compare.

The app also generates one clearly separated experimental **Ortak Türkçe / Shared Turkic** form. This is not presented as a standardized language. It is an LLM-generated bridge form intended to maximize broad intelligibility across the eight supported languages with minimum semantic loss.

The product is intentionally small. Do not turn it into a general-purpose translation suite.

---

## 2. Deployment architecture, hard requirement

The public frontend will be hosted as a GitHub Pages project site at:

`https://kaankurtoglu8.github.io/turanslate`

GitHub Pages is static hosting. Therefore:

- The OpenAI API key must never be present in browser code, built JavaScript, committed files, GitHub Pages artifacts, or any `VITE_*` variable.
- Authentication, OpenAI requests, account management, and query logging must run on a separate backend.
- The frontend may be public and inspectable. The backend must enforce authentication on every protected API route.

### Recommended v1 architecture

Use this architecture unless the repository already contains an equivalent secure backend setup:

- **Frontend:** Vite + React + TypeScript, statically built for GitHub Pages.
- **Frontend deployment:** GitHub Actions to GitHub Pages.
- **GitHub Pages base path:** `/turanslate/`.
- **Backend:** Cloudflare Worker.
- **Database:** Cloudflare D1.
- **Production OpenAI secret:** Cloudflare Worker secret named `OPENAI_API_KEY`.
- **Session signing / auth secret:** backend secret, never frontend configuration.
- **Frontend backend URL:** a public non-secret config such as `VITE_API_BASE_URL`.

Equivalent serverless architecture is acceptable only if it preserves all security and functional requirements. Do not replace the secure backend with direct browser calls to OpenAI.

### Local environment files

Create and maintain a defensive `.gitignore`.

At minimum ignore:

```gitignore
.env
.env.*
!.env.example
!.env.local.example
.dev.vars
.dev.vars.*
users.seed.local.json
node_modules/
dist/
.wrangler/
.DS_Store
```

Provide safe templates such as:

- `.env.local.example` for non-secret local frontend config, primarily `VITE_API_BASE_URL`.
- `worker/.dev.vars.example` or equivalent for local backend secret names without real values.
- `users.seed.example.json` containing fake example credentials only.

A developer may keep a local `.env.local` if useful, but **an OpenAI key in `.env.local` is only safe if it is consumed exclusively by server-side local tooling and never bundled into the static frontend**. For the Cloudflare Worker local runtime, prefer the platform-supported local secret file such as `.dev.vars`.

Never commit a real OpenAI key or real plaintext user password.

---

## 3. Core product principles

1. The main experience is the vertical, linear comparison of eight Turkic languages.
2. Output order is always fixed regardless of the input language.
3. The app accepts input in all eight main languages plus a small number of explicit regional input variants.
4. Automatic source-language detection is the default.
5. Detection does not need to be perfect. Show the detected language and a simple `Değiştir / Change` action.
6. Do not show numeric model confidence scores.
7. Only one source language needs to be highlighted in the output.
8. Translation, source detection, transliteration, and Ortak Türkçe generation happen in exactly one LLM request per translation action.
9. Do not implement deterministic transliteration rules. Transliteration is LLM-generated because names and contextual pronunciation can make rigid character mapping misleading.
10. The app should feel educational, comparative, calm, and modern.
11. UI localization is independent of translation. Turkish UI is default, English UI is optional.

---

## 4. Main languages and fixed output order

Use this exact internal order:

1. `tr`  Türkiye Turkish
2. `az`  Azerbaijani
3. `tk`  Turkmen
4. `uz`  Uzbek
5. `ug`  Uyghur
6. `ky`  Kyrgyz
7. `kk`  Kazakh
8. `tt`  Tatar

Canonical code order:

`tr -> az -> tk -> uz -> ug -> ky -> kk -> tt`

The order is deliberately linear for comparison. Do not describe it as a scientifically exact single dialect continuum or strict phylogenetic order.

### Families used in the UI

**Oğuz / Oghuz**
- `tr`
- `az`
- `tk`

**Karluk**
- `uz`
- `ug`

**Kıpçak / Kipchak**
- `ky`
- `kk`
- `tt`

`tt` means modern standard Volga/Kazan Tatar associated with Tatarstan. It does not mean Crimean Tatar.

---

## 5. UI localization

The site has a compact language toggle in the top-right corner:

`TR | EN`

Default: `TR`.

The toggle changes **interface labels only**, not the actual translated sentences.

All user-visible interface strings must come from centralized i18n dictionaries. Do not hard-code Turkish or English labels inside components.

### Required language labels

| Code | Turkish UI | English UI |
|---|---|---|
| `tr` | Türkiye Türkçesi | Türkiye Turkish |
| `az` | Azerbaycan Türkçesi | Azerbaijani |
| `tk` | Türkmence | Turkmen |
| `uz` | Özbekçe | Uzbek |
| `ug` | Uygurca | Uyghur |
| `ky` | Kırgızca | Kyrgyz |
| `kk` | Kazakça | Kazakh |
| `tt` | Tatarca | Tatar |

Do not use native autonyms such as `O‘zbekcha` as the main UI label when Turkish UI is active. Use `Özbekçe`. When English UI is active, use `Uzbek`.

### Required family labels

| Turkish UI | English UI |
|---|---|
| Oğuz grubu | Oghuz group |
| Karluk grubu | Karluk group |
| Kıpçak grubu | Kipchak group |

### Required common form label

| Turkish UI | English UI |
|---|---|
| Ortak Türkçe | Shared Turkic |
| Deneysel ortak biçim | Experimental shared form |

### Other minimum UI strings

Localize at least:

- Kullanıcı adı / Username
- Şifre / Password
- Giriş yap / Sign in
- Çıkış yap / Sign out
- Otomatik algıla / Auto-detect
- Çevir / Translate
- Değiştir / Change
- Kaynak / Source
- olarak algılandı / detected
- Geçmiş / Logs or History, depending on context
- Yönetim / Admin
- Yükleniyor / Loading
- error and empty-state text

---

## 6. Input language selector

Default mode: `auto`.

The selector supports the eight main languages plus two input-only regional variants.

Visually group variants beneath their parent language where practical.

### Turkish UI structure

```text
Otomatik algıla
Türkiye Türkçesi
Azerbaycan Türkçesi
  Kuzey / standart
  Güney
Türkmence
Özbekçe
  Özbekistan standardı
  Güney / Afganistan
Uygurca
Kırgızca
Kazakça
Tatarca
```

### English UI structure

```text
Auto-detect
Türkiye Turkish
Azerbaijani
  North / standard
  South / Iran
Turkmen
Uzbek
  Uzbekistan standard
  South / Afghanistan
Uyghur
Kyrgyz
Kazakh
Tatar
```

### Internal source IDs

- `auto`
- `tr`
- `az`
- `az-south`
- `tk`
- `uz`
- `uz-south`
- `ug`
- `ky`
- `kk`
- `tt`

`az-south` and `uz-south` are app-internal identifiers, not ISO 639-1 codes.

If source is `az-south`, the fixed `az` output is still standard/northern Azerbaijani.
If source is `uz-south`, the fixed `uz` output is still standard Uzbekistan Uzbek.

Writing system differences alone must not create more dropdown entries. For example, if a supported language is entered in a recognized alternate script, the system should interpret it without asking the user to choose a separate script profile.

Do not add Crimean Tatar, Bashkir, Karakalpak, Nogai, or additional output languages in v1 unless explicitly requested later.

---

## 7. Automatic source-language detection UX

Automatic detection is part of the same LLM call as translation.

After a result, show a compact localized status, for example:

Turkish:
`Kazakça olarak algılandı · Değiştir`

English:
`Detected as Kazakh · Change`

`Değiştir / Change` should open or focus the language selector.

For extremely short or ambiguous input, it is acceptable for the model to choose one best guess. If a word exists in multiple languages, only one row needs to be highlighted.

Do not implement a numeric confidence meter.

---

## 8. Flags

The repository already contains a `flags/` directory with SVG assets such as:

- `flags/tr.svg`
- `flags/az.svg`
- `flags/tk.svg`
- `flags/uz.svg`
- `flags/ug.svg`
- `flags/ky.svg`
- `flags/kk.svg`
- `flags/tt.svg`

Inspect actual filenames before implementation. Use existing local assets and do not fetch remote flags.

Show flags:

1. beside language choices in the input selector where practical,
2. beside every natural-language label in the output.

For `az-south`, reuse the Azerbaijani asset unless a dedicated asset is later added.
For `uz-south`, reuse the Uzbek asset unless a dedicated asset is later added.

`Ortak Türkçe / Shared Turkic` is synthetic and should not be given a national flag by default.

Do not block the app if an optional flag asset is missing. Use a graceful fallback.

---

## 9. Visual design and color system

Overall site theme:

- white base,
- light turquoise accents,
- clean dark text,
- restrained borders and shadows,
- calm, modern, friendly appearance.

Recommended base tokens, adjust slightly if needed for accessibility:

```text
page background:      #FFFFFF
soft turquoise:       #E8FAFA
primary turquoise:    #28BFC3
strong turquoise:     #15999D
text:                 #17393A
muted text:           #617879
border:               #D9EEEE
```

The family cards remain distinct from the global turquoise theme:

```text
Oğuz:          very light red       #FDECEC
Karluk:        very light brown     #F5EBDD
Kıpçak:        very light blue      #EAF3FF
Ortak Türkçe:  very light green     #EAF7EC
```

Keep family colors pale. They are an annotation system, not the main brand color.

Use good contrast and do not rely on color alone to communicate family membership or source status.

---

## 10. Page structure

The application is a responsive single-page experience.

### Signed-out state

On first visit, show a focused login interface before translation functionality is accessible.

Required elements:

- Turanslate branding,
- username field,
- password field,
- sign-in button,
- `TR | EN` toggle in the top-right.

Do not reveal whether a particular username exists in detailed error messages. A generic localized invalid-credentials message is enough.

### Signed-in top area

- Turanslate wordmark/title,
- `TR | EN` toggle in top-right,
- compact signed-in username,
- sign-out action,
- admin/log action only for admin users,
- short sentence input,
- input-language selector,
- primary translate action,
- detected-language status after a result.

Input is expected to be short, usually around one sentence. Do not design around document translation.

### Results

Display translations vertically in this fixed order:

`tr -> az -> tk -> uz -> ug -> ky -> kk -> tt`

Use three subtle family containers:

- Oğuz group, light red
- Karluk group, light brown
- Kipchak group, light blue

Each natural-language row contains:

- local flag SVG,
- localized language name,
- optional small `Kaynak / Source` indicator,
- primary Latin/transliterated sentence,
- native-script secondary sentence when required.

Below all families, leave clear vertical separation and render `Ortak Türkçe / Shared Turkic` inside its own light-green card.

---

## 11. Transliteration and native script

The primary text for every output language should use an **LLM-generated Turkish-reader-friendly Latin transliteration** so script differences do not dominate the comparison.

Do not implement deterministic character-by-character transliteration.

Required native-script secondary lines:

- `ug`: Arabic-based Uyghur script
- `ky`: Cyrillic
- `kk`: Cyrillic for v1
- `tt`: Cyrillic

The Latinized line is visually primary. The native line is smaller and quieter, but still readable.

For `tr`, `az`, `tk`, and `uz`, do not duplicate the same sentence below unless a later requirement explicitly calls for it.

The Latin transliteration may use a few extra Latin letters when useful. Do not force every sound into only the 29 letters of the Türkiye Turkish alphabet if that destroys meaningful distinctions.

---

## 12. Ortak Türkçe / Shared Turkic

This is an experimental synthesized bridge form, not a ninth natural language and not a claimed standard language.

It appears below the eight natural languages in a clearly separated light-green card.

### Generation rules

The LLM should:

1. Conceptually produce the eight real-language forms first.
2. Synthesize Shared Turkic by comparing those forms.
3. Preserve source meaning as closely as possible.
4. Prefer roots and constructions broadly recognizable across multiple supported languages.
5. Avoid simply outputting Türkiye Turkish with altered spelling.
6. Avoid making any single modern language the center.
7. Prefer transparent morphology and broadly recognizable modern forms.
8. Avoid obscure archaisms when they reduce modern intelligibility.
9. Prefer a shared Turkic-origin term when it is genuinely broadly recognizable, but never distort meaning merely to avoid a loanword.
10. Prioritize cross-language intelligibility over native-like purity in any one language.

### Shared Turkic orthography

Use a consistent extended Latin orthography based on the Turkish Latin alphabet.

Allow when useful:

- `q`
- `x`
- `ñ`
- `ä`

Prefer consistent spellings:

- `ş`, not `sh`
- `ç`, not `ch`
- `ñ`, not `ng` when representing the relevant single sound
- `x`, not `kh` when appropriate
- `ğ`, not `gh` when appropriate
- `ä` rather than inconsistent `ə`/`ä` switching

Do not output Cyrillic or Arabic characters in Shared Turkic.

---

## 13. Authentication

Authentication is intentionally simple for v1, but it must be enforced server-side.

### Account provisioning

The owner manually maintains a **local, gitignored** plaintext seed file such as:

`users.seed.local.json`

Example structure:

```json
[
  {
    "username": "example",
    "password": "change-me",
    "role": "user"
  }
]
```

This plaintext file exists only on the owner's local machine and must never be committed or served by GitHub Pages.

Provide a script or documented command that imports/synchronizes this seed file into the backend database. During import:

- normalize usernames consistently,
- generate a unique salt per password,
- store only a strong salted password hash in D1,
- never store plaintext passwords in D1,
- support `role: "admin"` and `role: "user"`,
- support disabling/removing an account cleanly.

### Initial owner account

The initial owner/admin username is:

- username: `kurtoglu`
- role: `admin`

The owner will place the real password manually in the gitignored `users.seed.local.json` file before seeding. Do not put that plaintext password in `AGENTS.md`, committed source code, frontend assets, example files, or deployment configuration.

### Sessions

After successful login, the backend issues a session credential.

For this cross-origin GitHub Pages plus Worker architecture, prefer a simple opaque random session token or equivalent secure session mechanism. The frontend sends it in an `Authorization` header to protected backend calls. Store browser-side session state no more persistently than necessary, preferably `sessionStorage` for v1.

Backend sessions must:

- expire,
- be revocable,
- map to a user record,
- be checked on every protected endpoint.

Do not rely on the frontend login screen itself as an access-control boundary.

Add basic login abuse protection appropriate for a small private app, such as bounded rate limiting or short lockouts.

---

## 14. Query logging and admin view

Every authenticated translation request must be associated with the signed-in user and logged server-side in D1. Logging is a required v1 feature, not an optional extension.

### Required log fields

Store at least:

- log id,
- user id,
- username or joinable user reference,
- UTC timestamp,
- raw input sentence,
- selected source mode/id,
- detected source id returned by the model,
- model identifier,
- request success/failure status,
- the complete validated translation result returned to the user, including all eight natural-language outputs, native-script forms where present, and Shared Turkic,
- input token count when available,
- output token count when available,
- total token count when available,
- estimated input cost in USD when pricing is configured,
- estimated output cost in USD when pricing is configured,
- estimated total cost in USD when pricing is configured.

Persist the structured model result as JSON, for example in a `response_json` text column, so the exact historical output can be inspected later without reconstructing it. On failed requests, store a safe failure code/message rather than raw provider responses.

Do not log OpenAI API keys, session tokens, password material, authorization headers, password hashes, or other secrets.

### Token and cost semantics

Keep token counts separate. Do not store only one ambiguous `tokens` number.

- `input_tokens`: billable/request input token count reported by the provider.
- `output_tokens`: generated output token count reported by the provider.
- `total_tokens`: `input_tokens + output_tokens`, or the provider-reported total when equivalent.

The main token column in the admin log table may display `total_tokens`, but a log detail view must show input, output, and total separately.

Cost must be derived from separate input and output pricing because they may differ substantially. Do not hard-code a model price into UI components. Keep pricing configurable on the backend, for example:

```text
OPENAI_INPUT_USD_PER_1M=...
OPENAI_OUTPUT_USD_PER_1M=...
```

Then calculate:

```text
estimated_input_cost_usd  = input_tokens  / 1_000_000 * input_price_per_1m
estimated_output_cost_usd = output_tokens / 1_000_000 * output_price_per_1m
estimated_total_cost_usd  = estimated_input_cost_usd + estimated_output_cost_usd
```

If the API exposes cached or reasoning-token details, it is acceptable to store them in optional columns/JSON metadata for future analysis, but they are not required in the primary v1 UI.

### Admin UI

Only `admin` users can access the log viewer.

Provide an admin panel accessible from the signed-in header. It should include a compact overview plus inspectable per-query logs.

The log list must support:

- newest-first recent logs,
- username filter,
- basic pagination or `load more`,
- timestamp,
- username,
- input sentence preview,
- selected/detected source,
- model,
- total token usage,
- estimated total cost when configured,
- success/failure state.

Selecting a log row must open a detail view that shows:

- full input text,
- full stored output exactly as returned to the user, rendered readably using the same language order where practical,
- selected and detected source,
- model,
- input tokens,
- output tokens,
- total tokens,
- estimated input cost,
- estimated output cost,
- estimated total cost,
- timestamp and username,
- safe failure information if the request failed.

Also provide simple aggregate usage summaries for the owner, at minimum per user:

- translation/query count,
- summed input tokens,
- summed output tokens,
- summed total tokens,
- summed estimated cost.

Normal users must not be able to access another user's logs or admin aggregates. Backend authorization must enforce this even if the frontend is manipulated.

---

## 15. Backend database model

A small D1 schema is enough.

Suggested entities:

### `users`

- `id`
- `username` unique
- `password_hash`
- `password_salt` or algorithm-specific encoded hash data
- `role`
- `is_active`
- `created_at`
- `updated_at`

### `sessions`

- `id` or token hash
- `user_id`
- `expires_at`
- `created_at`
- optional `revoked_at`

### `query_logs`

Fields described in the logging section. The schema should explicitly include token counters, cost estimates, and a `response_json` field containing the complete validated output shown to the user. Use numeric types appropriate for token counts and sufficient precision for small USD cost values.

Use migrations. Do not create tables ad hoc at runtime.

---

## 16. Backend API

Keep the API intentionally small.

Suggested endpoints:

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /translate
GET  /admin/logs
GET  /admin/logs/:id
GET  /admin/usage-summary
```

All endpoints except `/auth/login` require a valid session.
All `/admin/*` endpoints additionally require the admin role. If the implementation can cleanly return row details from the list endpoint, `/admin/logs/:id` may be omitted, but admin-only backend enforcement remains mandatory.

Restrict CORS in production to the intended GitHub Pages origin:

`https://kaankurtoglu8.github.io`

Allow explicit local development origins only in development configuration.

Never use `Access-Control-Allow-Origin: *` together with sensitive authenticated APIs unless there is a specific reviewed reason.

---

## 17. LLM architecture

Use exactly **one OpenAI model request per translation action**.

That single request performs:

1. source-language detection when `auto` is selected,
2. interpretation of explicitly selected source/variant,
3. translation into all eight fixed languages,
4. Turkish-reader-friendly Latin transliteration for all eight,
5. native-script output where required,
6. Shared Turkic synthesis.

Do not make separate calls per language.
Do not make a separate source-detection call.
Do not make a separate Shared Turkic call.

The backend, not the browser, calls OpenAI.

Keep model name configurable through a backend environment variable, for example:

`OPENAI_MODEL=...`

### Recommended structured response shape

```json
{
  "detectedSource": "kk",
  "translations": {
    "tr": { "latin": "..." },
    "az": { "latin": "..." },
    "tk": { "latin": "..." },
    "uz": { "latin": "..." },
    "ug": { "latin": "...", "native": "..." },
    "ky": { "latin": "...", "native": "..." },
    "kk": { "latin": "...", "native": "..." },
    "tt": { "latin": "...", "native": "..." }
  },
  "common": {
    "latin": "..."
  }
}
```

Validate model output before returning it to the frontend.

Keep the OpenAI/provider layer isolated in one backend module so it can be changed later.

---

## 18. Translation-system prompt requirements

The prompt should be compact because it is paid input on every request.

It must clearly communicate:

- supported source languages and input-only variants,
- fixed output languages and order,
- source detection only when auto mode is selected,
- respect for explicit source selection,
- natural target-language grammar and vocabulary,
- no mechanical copying of Türkiye Turkish,
- no invented terminology,
- sensible preservation of proper names,
- contextual Latin transliteration,
- native-script output for `ug`, `ky`, `kk`, `tt`,
- Shared Turkic synthesis only after considering all eight natural-language forms,
- neutral Shared Turkic construction rather than Türkiye-centric output,
- prescribed Shared Turkic Latin spelling conventions,
- valid structured JSON only,
- no explanatory prose.

Do not add BLEU scoring, LLM judging, RAG, dictionary retrieval, or expert-review flows in v1.

---

## 19. Error handling

Handle at least:

- invalid login,
- inactive account,
- expired/revoked session,
- empty translation input,
- model/API failure,
- invalid structured model response,
- missing translation fields,
- missing optional flag asset,
- request timeout,
- admin authorization failure,
- database failure.

Do not expose raw provider errors, stack traces, SQL, API keys, hashes, or auth details to the browser.

---

## 20. Performance and cost principles

Inputs are usually one short sentence.

- Keep the model system prompt compact.
- Return only fields the UI needs.
- Make one model call per translation action.
- Store input, output, and total token usage in the query log when OpenAI returns it.
- Store the complete validated translation output for each successful request.
- Compute and store separate input/output/total estimated USD cost when backend pricing configuration is available.
- Do not downgrade translation quality merely to save tiny fractions of a cent without an explicit product decision.
- Avoid unnecessary client dependencies.

---

## 21. Accessibility and responsiveness

- Mobile-first responsive layout.
- Keyboard-accessible controls.
- Clear focus states.
- Semantic labels for login, input, language selector, buttons, and admin controls.
- Do not rely on color alone for language family or source state.
- Flags are contextual, language names remain visible as text.
- Native-script secondary text must remain readable.
- RTL rendering for Uyghur native script must display correctly without forcing the whole row into RTL.

---

## 22. GitHub Pages requirements

The frontend build must work from:

`https://kaankurtoglu8.github.io/turanslate`

Therefore:

- configure asset/base paths for `/turanslate/`,
- flag SVG URLs must resolve correctly under that base path,
- do not assume deployment at `/`,
- provide a GitHub Actions Pages workflow,
- do not require server-side rendering from GitHub Pages,
- keep routing compatible with static hosting. Prefer one-page state or hash routing if routing is needed.

---

## 23. Scope boundaries for v1

Do not add unless explicitly requested:

- public registration,
- password reset email flows,
- OAuth/social login,
- user-editable profile pages,
- public query history,
- BLEU/benchmark dashboards,
- expert-review workflows,
- RAG,
- grammar-book retrieval,
- dictionary retrieval,
- multi-document translation,
- text-to-speech,
- pronunciation scoring,
- family-tree visualization,
- deterministic transliteration,
- extra Turkic output languages,
- separate LLM judge calls,
- numerical confidence scores.

V1 accounts are owner-provisioned only.

---

## 24. Centralized metadata

Keep language metadata, input variants, UI translations, family labels, colors, and flag paths centralized.

Do not scatter arrays or translated names across components.

A main language config should expose fields similar to:

```ts
{
  id,
  labels: { tr, en },
  family,
  flagPath,
  requiresNativeLine,
  outputOrder
}
```

Input variants should be a separate typed config tied to a parent language.

Family metadata should contain localized names and background tokens.

---

## 25. Working style for coding agents

Before changing code:

1. Inspect the repository and the actual `flags/` assets.
2. Read this entire file.
3. Preserve existing assets.
4. Determine whether a framework already exists.
5. Because production hosting is GitHub Pages, do not choose a frontend architecture that requires a Node server at runtime.
6. If the repo contains only static assets, use Vite + React + TypeScript for the frontend and a separate Cloudflare Worker + D1 backend.
7. Keep frontend and backend concerns clearly separated.
8. Implement authentication and API security before wiring real OpenAI calls into the public frontend.
9. Use typed schemas and migrations.
10. Run formatter, linter, typecheck, tests if available, and production builds.
11. Verify the built frontend works with the `/turanslate/` base path.
12. Never commit secret values or the real local user seed file.

Prefer small typed modules and clear separation among:

- language metadata,
- i18n,
- UI presentation,
- auth state,
- backend API client,
- Worker routes,
- database access,
- OpenAI prompt construction,
- OpenAI response validation,
- admin log retrieval.

Do not add unnecessary architecture beyond what is needed for secure static deployment, private accounts, translation, and logs.
