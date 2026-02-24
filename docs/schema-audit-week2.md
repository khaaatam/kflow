# Schema Audit (Week 2)

## Temuan utama

1. `models/ChatLog.js` memakai kolom `created_at` untuk statistik harian.
2. Skema lama `full_chat_logs` sempat memakai kolom `waktu`.
3. Perlu kompatibilitas untuk database lama agar statistik tidak error.

## Aksi yang diambil

- Menstandarkan `full_chat_logs` ke `created_at`.
- Menambahkan migrasi kompatibilitas untuk menambah/backfill `created_at` jika sebelumnya hanya ada `waktu`.
- Menambahkan tabel `schema_migrations` untuk versioned migration.
- Menambahkan index penting:
  - `full_chat_logs(nama_pengirim)`
  - `full_chat_logs(created_at)`
  - `events(tanggal)`
