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

# Start bot (auto-start MySQL + SSH + tmux + PM2)
./start.sh
```

### Remote Access (SSH + tmux)

```bash
# From Windows PC (PowerShell)
tmux

# From Linux/Mac
./tmux-connect.sh

# Or manual SSH
ssh -i ~/.ssh/id_ed25519 u0_a123@192.168.1.35 -p 8022
tmux attach -t bot
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run start` | Run bot + web dashboard |
| `npm run check` | Syntax-check core files |
| `npm test` | Run Jest tests (rate limiter + logger) |
| `npm run lint` | ESLint check (0 errors target) |

## Architecture

```
app.js                  # Entry point: inits DB, Express, WhatsApp client, cron, graceful shutdown
config.js               # GITIGNORED — loads .env, exports { creator, botName, users, ownerNumber, database, ai, system }
lib/database.js         # MySQL pool + auto-migration (base tables, legacy compat, indexes)
lib/ai.js               # Google Generative AI (Gemini) client
lib/logger.js           # Centralized logger (debug/info/warn/error) — replaces all console.log
lib/rateLimiter.js      # In-memory rate limiter (AI: 5/min, downloader: 3/min per user)
handlers/message.js     # Central message router — auto-discovers commands, cooldown, async DB logging, observer debounce
commands/*.js           # Each exports: async handler + module.exports.metadata = { category, commands: [...] }
models/*.js             # Query helpers (ChatLog, Memory, Transaction)
routes/web.js           # Express dashboard with auth + health endpoint
views/index.ejs         # Dashboard template with password support
migrations/*.sql        # Versioned SQL migrations (run once, tracked in schema_migrations)
setup.sh                # Termux auto-setup (x11-repo, chromium, mariadb, openssh, tmux, sshd auto-start)
start.sh                # Termux start script (tmux session + MySQL + SSH + PM2 with memory limits)
tmux.bat                # Windows PC remote connect (SSH + tmux attach)
tmux-connect.sh         # Linux/Mac remote connect
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
- Commands are registered in `handlers/message.js:10-29`

## Database

- MySQL/MariaDB via `mysql2` pool (connectionLimit: 3)
- Tables auto-created on startup: `full_chat_logs`, `transaksi`, `memori`, `events`, `system_instruction`, `reminders`
- Migrations in `migrations/` run sequentially; tracked in `schema_migrations` table
- Legacy compat migrations handle schema drift (e.g. `waktu` → `created_at`)

## Key gotchas

- **`config.js` is gitignored.** It won't exist after clone. The app loads `.env` via dotenv in config.js — you must create `.env` first.
- **Sender ID normalization** (`handlers/message.js:51-56`): WhatsApp multi-device uses `@lid` and `@c.us` suffixes with `:20` segments. The handler strips the `:segment` part before matching against `config.users`.
- **Self-message filtering** (`handlers/message.js:46-49`): When `msg.fromMe`, senderId is forced to `client.info.wid._serialized` to avoid self-trigger loops.
- **Bot response filter** (`handlers/message.js:91-99`): Messages from self containing emoji-only, `[DEBUG]`, `SYSTEM ONLINE`, etc. are silently dropped.
- **Puppeteer**: `.puppeteerrc.cjs` sets `skipDownload: true`. Chromium must be pre-installed. `app.js` hardcodes paths for Windows and Termux — override via `PUPPETEER_EXECUTABLE_PATH` env var.
- **Chromium args** (`app.js`): Keep minimal for Termux stability. Do NOT add `--disable-gpu`, `--js-flags`, or other aggressive flags — they break `msg.downloadMedia()` (Puppeteer `page.evaluate` crash with `r: r` error). Only safe flags: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-accelerated-2d-canvas`, `--no-first-run`, `--no-zygote`.
- **`temp/` folder** is cleaned on startup (media files deleted).
- **Session auth**: WhatsApp Web session stored in `.wwebjs_auth/` + `.wwebjs_cache/` inside project folder (not `~/`). To reset session: `rm -rf .wwebjs_auth .wwebjs_cache` then restart.
- **Termux**: MySQL must be started manually each session (`mysqld_safe &`). Use `start.sh` to automate this. SSH auto-starts via `.bashrc`.
- **Dashboard auth**: Set `DASHBOARD_PASSWORD` in `.env` to protect mutation routes. Leave empty for open access.
- **Rate limiting**: AI (5/min) and downloader (3/min) are rate-limited per user via `lib/rateLimiter.js`.
- **AI Observer**: Auto-learns from registered users' chats. Debounce 10s per user. Non-removable — core feature.
- **Memory cleanup**: `Memory.cleanup()` runs on startup, keeps last 500 entries per user.
- **PM2**: Process managed by PM2 with `--max-memory-restart 400M --node-args="--max-old-space-size=350"`.

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
