# K-Flow

WhatsApp bot + dashboard event berbasis Node.js (Express + whatsapp-web.js + MySQL).

## 1) Setup cepat

```bash
npm install
cp .env.example .env
```

Lalu edit `.env` sesuai environment kamu (minimal `DB_*`, `LOG_NUMBER`, dan `ROUTER_API_KEY` kalau mau fitur AI aktif).

## 2) Jalankan aplikasi

```bash
npm run start
```

- Bot WhatsApp akan minta scan QR.
- Dashboard web jalan di `http://localhost:<PORT>`.
- Saat startup, app akan menyiapkan schema dasar dan menjalankan migration SQL di folder `migrations/` secara berurutan.

## 3) Environment variables utama

- `PORT` - port web server.
- `LOG_NUMBER` - nomor WhatsApp tujuan notifikasi sistem (`@c.us` / `@lid`).
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - konfigurasi MySQL.
- `ROUTER_API_KEY` - API key dari 9Router dashboard untuk fitur AI.
- `ROUTER_URL` - endpoint 9Router (default: `http://localhost:20128/v1`).
- `ROUTER_MODEL` - model AI yang dipakai (default: `mimo/mimo-v2.5-flash`).
- `PUPPETEER_EXECUTABLE_PATH` - opsional, isi kalau Chromium tidak terdeteksi otomatis.

Lihat contoh lengkap di `.env.example`.

## 4) Troubleshooting

### QR tidak muncul / Chromium gagal jalan
- Pastikan dependency browser tersedia.
- Jika auto-detect gagal, isi `PUPPETEER_EXECUTABLE_PATH` di `.env`.

### Error koneksi database
- Pastikan MySQL aktif.
- Pastikan `DB_*` di `.env` benar.

### Fitur AI selalu balas error
- Pastikan 9Router sudah jalan di `http://localhost:20128`.
- Pastikan `ROUTER_API_KEY` valid (ambil dari dashboard 9Router).
- Pastikan API key provider (misal Xiaomi MiMo) sudah ditambah di 9Router dashboard.

## 5) Scripts

```bash
npm run start
npm run check
npm run lint
npm test
```

- `start`: jalankan bot + web dashboard.
- `check`: validasi syntax file inti.
- `lint`: jalankan ESLint.
- `test`: jalankan unit test (Jest).
