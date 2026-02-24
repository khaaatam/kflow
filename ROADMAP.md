# K-Flow Roadmap (4 Minggu)

Dokumen ini fokus ke peningkatan **stabilitas**, **keamanan**, dan **maintainability** tanpa mengganggu flow bot yang sudah berjalan.

## Prinsip Eksekusi

1. **Small and safe changes**: pecah per PR kecil.
2. **No big-bang rewrite**: refactor bertahap sambil fitur tetap jalan.
3. **Test before merge**: setiap perubahan harus punya validasi minimal.

---

## Minggu 1 — Stabilitas Dasar & Rapihin Konfigurasi

### Tujuan
- App lebih portable (lokal/server/container).
- Risiko salah konfigurasi berkurang.

### Task
- Pindahkan konfigurasi sensitif/hardcoded ke environment variable:
  - nomor owner/log,
  - DB credentials,
  - port,
  - path Chromium/Puppeteer.
- Tambahkan `.env.example` dengan default aman.
- Tambahkan fallback logic Puppeteer jika `executablePath` tidak diset.
- Buat `README.md` baseline:
  - cara install,
  - cara run,
  - env wajib,
  - troubleshooting cepat.

### Deliverable
- `.env.example` siap pakai.
- README onboarding 5-10 menit.
- Bot bisa jalan di mesin non-Termux tanpa edit source code.

### Acceptance Criteria
- Menjalankan app cukup dengan copy `.env.example` -> `.env` lalu start.
- Tidak ada credential hardcoded di source.

---

## Minggu 2 — Data Layer & Konsistensi Schema

### Tujuan
- Hilangkan bug query akibat mismatch schema.
- Buat migrasi DB lebih terkontrol.

### Task
- Audit semua kolom tabel yang dipakai query (`waktu` vs `created_at` dkk).
- Standarisasi timestamp (`created_at`/`updated_at`) lintas tabel.
- Pisahkan `db.init()` menjadi:
  - `bootstrap` untuk install awal,
  - `migration` versi bertahap (v1, v2, ...).
- Tambahkan index untuk query yang sering dipakai:
  - `full_chat_logs(nama_pengirim)`,
  - `full_chat_logs(created_at)`,
  - `events(tanggal)`.

### Deliverable
- Dokumen mapping schema final.
- Migration script idempotent dan aman di-run ulang.

### Acceptance Criteria
- Query statistik tidak error lagi.
- Fresh install + upgrade install lama sama-sama sukses.

---

## Minggu 3 — Testing & Reliability

### Tujuan
- Punya safety net sebelum merge.
- Bug regresi command parsing cepat ketahuan.

### Task
- Setup test runner (mis. Jest) + script `npm test` yang valid.
- Unit test minimal untuk:
  - parser command (`!`, `/`),
  - gatekeeper public command,
  - cooldown logic.
- Tambah integration-ish test untuk handler dengan mock client/msg.
- Tambah script `npm run lint` (ESLint) untuk standar kualitas.

### Deliverable
- Pipeline lokal: `npm test` dan `npm run lint`.
- Coverage awal untuk flow kritikal message handler.

### Acceptance Criteria
- `npm test` tidak lagi placeholder.
- PR baru wajib lolos test minimal.

---

## Minggu 4 — Security, Ops, dan UX Admin

### Tujuan
- Dashboard lebih aman.
- Operasional bot lebih mudah dipantau.

### Task
- Tambahkan auth sederhana untuk route dashboard (`/add`, `/delete/:id`).
- Tambahkan validasi input server-side untuk form event.
- Buat centralized logger (level info/warn/error + timestamp).
- Tambahkan health endpoint (`/health`) untuk monitoring.
- Tambahkan backup rutin DB (script + panduan restore).

### Deliverable
- Dashboard tidak bisa diakses/ubah data tanpa otorisasi.
- Punya SOP singkat backup-restore.

### Acceptance Criteria
- Endpoint mutasi data terlindungi.
- Monitoring basic tersedia untuk cek status service.

---

## Backlog Setelah 4 Minggu (Opsional)

- Rate limit per user untuk command berat (AI/download).
- Queue untuk job media/AI biar tidak blocking event loop.
- Feature flag untuk nyalakan/matiin fitur per environment.
- CI sederhana (GitHub Actions): install, lint, test.
- Observability lebih lanjut: metrics command usage harian.

---

## Urutan Eksekusi PR (Saran)

1. PR-1: env refactor + `.env.example` + README.
2. PR-2: schema fix + migration versioning.
3. PR-3: testing setup + test kritikal handler.
4. PR-4: dashboard auth + input validation + health endpoint.

Dengan urutan ini, risiko konflik antar perubahan lebih kecil dan setiap minggu ada hasil yang langsung terasa.
