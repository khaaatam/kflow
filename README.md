# K-Flow

WhatsApp bot + dashboard event berbasis Node.js (Express + whatsapp-web.js + MySQL).

## 1) Setup cepat

```bash
npm install
cp .env.example .env
```

Lalu edit `.env` sesuai environment kamu (minimal `DB_*`, `LOG_NUMBER`, dan `GEMINI_API_KEY` kalau mau fitur AI aktif).

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
- `GEMINI_API_KEY` - aktifkan fitur AI.
- `PUPPETEER_EXECUTABLE_PATH` - opsional. Jika kosong, app akan auto-detect dari lokasi umum (termasuk Termux). Isi manual jika auto-detect gagal.

Lihat contoh lengkap di `.env.example`.

## 4) Troubleshooting

### QR tidak muncul / Chromium gagal jalan
- Pastikan dependency browser tersedia.
- Untuk Termux, app akan coba deteksi `chromium-browser` / `chromium` otomatis.
- Jika masih gagal, cek hasil `which chromium-browser` atau `which chromium`, lalu isi `PUPPETEER_EXECUTABLE_PATH` di `.env`.

### Error koneksi database
- Pastikan MySQL aktif.
- Pastikan `DB_*` di `.env` benar.

### Fitur AI selalu balas error
- Pastikan `GEMINI_API_KEY` valid.
- Cek limit/kuota provider AI.

## 5) Scripts

```bash
npm run start
npm run check
npm test
```

- `start`: jalankan bot + web dashboard.
- `check`: validasi syntax file inti.
- `test`: placeholder (belum ada unit test resmi).
