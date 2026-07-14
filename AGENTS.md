# AGENTS.md — K-Flow

WhatsApp bot + dashboard (Node.js / Express / whatsapp-web.js / MySQL).

## Quick start

```bash
npm install
cp .env.example .env   # then fill DB_*, LOG_NUMBER, GEMINI_API_KEY
npm run start
```

Bot scans QR in terminal. Dashboard at `http://localhost:<PORT>`.

### Termux (HP)

```bash
# Setup awal (sekali saja)
chmod +x setup.sh start.sh
./setup.sh

# Edit .env sesuai nomor kamu
nano .env

# Start bot
./start.sh
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run start` | Run bot + web dashboard |
| `npm run check` | Syntax-check core files (app.js, config.js, handlers/message.js, lib/database.js) |
| `npm test` | Run Jest tests (rate limiter + logger) |
| `npm run lint` | ESLint check |

## Architecture

```
app.js                  # Entry point: inits DB, Express, WhatsApp client, cron
config.js               # GITIGNORED — loads .env, exports { creator, botName, users, ownerNumber, database, ai, system }
lib/database.js         # MySQL pool + auto-migration (base tables, legacy compat, indexes)
lib/ai.js               # Google Generative AI (Gemini) client
lib/logger.js           # Centralized logger (debug/info/warn/error)
lib/rateLimiter.js      # In-memory rate limiter
handlers/message.js     # Central message router — auto-discovers commands, handles cooldown, logging
commands/*.js           # Each exports: async handler + module.exports.metadata = { category, commands: [...] }
models/*.js             # Query helpers (ChatLog, Memory, Transaction)
routes/web.js           # Express dashboard with auth + health endpoint
views/index.ejs         # Dashboard template
migrations/*.sql        # Versioned SQL migrations (run once, tracked in schema_migrations)
setup.sh                # Termux auto-setup script
start.sh                # Termux start script (starts MySQL + bot)
```

## Command system

Commands are auto-loaded from `commands/*.js` at startup. Each file must export:

```js
module.exports = async (client, msg, args, senderId, namaPengirim, body) => { ... };
module.exports.metadata = {
  category: "...",
  commands: [
    { command: '!name', desc: '...', isPublic: true }  // isPublic = accessible by guests
  ]
};
```

- Prefix: `!` or `/`
- Cooldown: 1500ms per sender
- Guest users (not in `config.users`) can only run `isPublic` commands or send downloader links
- Commands are registered in `handler=message.js:10-29`

## Database

- MySQL via `mysql2` pool
- Tables auto-created on startup: `full_chat_logs`, `transaksi`, `memori`, `events`, `system_instruction`, `reminders`
- Migrations in `migrations/` run sequentially; tracked in `schema_migrations` table
- Legacy compat migrations in `lib/database.js:88-113` handle schema drift (e.g. `waktu` → `created_at`)

## Key gotchas

- **`config.js` is gitignored.** It won't exist after clone. The app loads `.env` via dotenv in config.js — you must create `.env` first.
- **Sender ID normalization** (`handlers/message.js:51-56`): WhatsApp multi-device uses `@lid` and `@c.us` suffixes with `:20` segments. The handler strips the `:segment` part before matching against `config.users`.
- **Self-message filtering** (`handlers/message.js:46-49`): When `msg.fromMe`, senderId is forced to `client.info.wid._serialized` to avoid self-trigger loops.
- **Bot response filter** (`handlers/message.js:91-99`): Messages from self containing emoji-only, `[DEBUG]`, `SYSTEM ONLINE`, etc. are silently dropped.
- **Puppeteer**: `.puppeteerrc.cjs` sets `skipDownload: true`. Chromium must be pre-installed. `app.js:38-39` hardcodes paths for Windows and Termux — override via `PUPPETEER_EXECUTABLE_PATH` env var.
- **`temp/` folder** is cleaned on startup (media files deleted).
- **package.json declares `packageManager: pnpm@10.20.0`** but scripts use `npm`. Either works; just be consistent.
- **Termux**: MySQL must be started manually each session (`mysqld_safe &`). Use `start.sh` to automate this.
- **Dashboard auth**: Set `DASHBOARD_PASSWORD` in `.env` to protect mutation routes. Leave empty for open access.
- **Rate limiting**: AI (5/min) and downloader (3/min) are rate-limited per user.

## Adding a new command

1. Create `commands/yourcmd.js`
2. Export the handler function and `metadata` (see existing commands for pattern)
3. It will be auto-discovered by `handlers/message.js` on next start
4. Set `isPublic: true` in metadata if guests should access it

## Environment variables

All in `.env` (see `.env.example`). Critical ones:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL connection
- `LOG_NUMBER` — WhatsApp ID for system notifications (e.g. `628xxx@c.us`)
- `GEMINI_API_KEY` — enables AI features
- `PUPPETEER_EXECUTABLE_PATH` — override Chromium path if auto-detect fails
- `DASHBOARD_PASSWORD` — password for dashboard mutations (leave empty to disable)
- `LOG_LEVEL` — logging level: debug, info, warn, error (default: info)
