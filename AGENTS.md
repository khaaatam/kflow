# AGENTS.md

## Project

WhatsApp bot + web dashboard. Node.js, CommonJS, Express 5, whatsapp-web.js, MySQL (mysql2), EJS.

## Commands

```bash
npm start          # Run bot + dashboard (node app.js)
npm run check      # Syntax check core files (--check, no execution)
npm run lint       # ESLint
npm test           # Jest (placeholder, only rateLimiter & logger tests)
```

No typecheck step. No build step. No monorepo.

## Architecture

- **app.js** — entrypoint. Inits DB, Express, WhatsApp client, reminder restore, event cron.
- **config.js** — reads `.env`, exports `creator`, `botName`, `users`, `ownerNumber`, `database`, `ai`, `system`.
- **handlers/message.js** — message router. Auto-loads all `commands/*.js` via `metadata.commands`. Exports `commands` Map.
- **commands/*.js** — each exports handler function + `module.exports.metadata = { category, commands: [{ command, desc, isPublic? }] }`. Handler signature: `(client, msg, args, rawSenderId, namaPengirim, body)`.
- **lib/ai.js** — OpenAI-compatible client via 9Router (`config.ai`). `generateContent(prompt)` returns `{ response: { text: () => string } }`.
- **lib/database.js** — MySQL pool, `db.init()` creates base tables + runs SQL migrations from `migrations/` + legacy compat patches. Always call `await db.init()` before using DB.
- **lib/react.js** — safe `msg.react()` wrapper, swallow errors.
- **lib/rateLimiter.js** — in-memory sliding window rate limiter.
- **lib/logger.js** — leveled logger (debug/info/warn/error), controlled by `LOG_LEVEL` env.
- **models/** — static classes: `Memory`, `Transaction`, `ChatLog`. All use `db.query()`.
- **routes/web.js** — Express routes for dashboard. Auth via `?password=` query param or `x-dashboard-password` header.
- **views/index.ejs** — single EJS template for dashboard.
- **migrations/** — `NNN_description.sql` files, tracked in `schema_migrations` table, run in sorted order on startup.

## 9Router (AI Gateway)

All AI calls go through a local 9Router instance — an OpenAI-compatible gateway at `http://localhost:20128/v1`. API key set via `ROUTER_API_KEY` env.

```bash
# Health check
curl http://localhost:20128/api/health

# List available models
curl http://localhost:20128/v1/models

# Test a completion
curl http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer $ROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"mimo/mimo-v2.5-pro","messages":[{"role":"user","content":"hi"}]}'
```

Additional endpoints: `/v1/models/image` (image-gen), `/v1/models/tts` (text-to-speech), `/v1/models/embedding` (embeddings), `/v1/models/web` (web search). Use `data[].id` as `model` field.

Errors: 401 → refresh key via Dashboard → Keys. 503 → wait `retry-after` or add another provider account.

Full skill reference: `skills/9router/SKILL.md` in the9router repo, or see capability skills at `skills/9router-chat/SKILL.md`, `skills/9router-image/SKILL.md`, etc.

## Key patterns

- Commands are auto-discovered: drop a `.js` in `commands/` with `metadata.commands` array and it's live.
- `isPublic: true` in command metadata = accessible to unregistered users (guests).
- `lib/ai.js` wraps the OpenAI SDK into a Gemini-like `generateContent()` interface for legacy compatibility.
- Media download uses Puppeteer page injection (`window.Store`) — not a simple HTTP fetch.
- `rawSenderId` vs `senderId`: rawSenderId preserves the full `:2`/`:20` suffix for cooldown tracking; senderId is cleaned for config lookup.

## Environment

Copy `.env.example` to `.env`. Required: `DB_*`, `LOG_NUMBER`, `ROUTER_API_KEY`. Optional: `PORT`, `DASHBOARD_PASSWORD`, `PUPPETEER_EXECUTABLE_PATH`.

## Gotchas

- Windows: Puppeteer defaults to `C:\Program Files\Google\Chrome\Application\chrome.exe`. Set `PUPPETEER_EXECUTABLE_PATH` if different.
- `temp/` folder auto-cleans media files (mp4/png/jpg/webp) on startup.
- Observer (AI memory extraction) has 10s debounce per user. Filter triggers are hardcoded in `commands/ai.js`.
- Dashboard auth is stateless — password in query string or header, no sessions.
- `module.exports` shape in command files matters: handler can be the export itself, or `module.exports.interact`. The loader checks both.
- Migrations are SQL files only. No JS migrations. Split statements on `;\n`.

## Lint rules

ESLint flat config. Key overrides: `no-unused-vars` warn with `argsIgnorePattern: ^_`, `no-empty` allows empty catch, `no-console` off.
