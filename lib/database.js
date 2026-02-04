const mysql = require('mysql2');
const config = require('../config');

// Buat Pool Koneksi
const pool = mysql.createPool(config.database);
const db = pool.promise();

// 👇 FUNGSI INIT DATABASE (AUTO-MIGRATION INCLUDED)
db.init = async () => {
    console.log("🛠️ Cek Tabel Database...");
    try {
        // 1. DEFINISI STRUKTUR TABEL IDEAL
        // (Perintah ini cuma jalan kalau tabel BELUM ADA sama sekali)
        const tables = [
            `CREATE TABLE IF NOT EXISTS full_chat_logs (id INT AUTO_INCREMENT PRIMARY KEY, nama_pengirim VARCHAR(100), pesan TEXT, is_forwarded BOOLEAN DEFAULT 0, waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS transaksi (id INT AUTO_INCREMENT PRIMARY KEY, user_id VARCHAR(50), jenis ENUM('pemasukan', 'pengeluaran'), nominal BIGINT, keterangan TEXT, sumber VARCHAR(50) DEFAULT 'WhatsApp', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS memori (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(100), fakta TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS events (id INT AUTO_INCREMENT PRIMARY KEY, nama_event VARCHAR(255), tanggal DATE, dibuat_oleh VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS system_instruction (id INT AUTO_INCREMENT PRIMARY KEY, instruction TEXT, is_active BOOLEAN DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
        ];

        for (const sql of tables) await db.query(sql);

        // ============================================================
        // 🚑 AUTO MIGRATION (DOKTER BEDAH DATABASE)
        // ============================================================

        // 1. Cek & Tambah Kolom 'user' di tabel 'memori'
        try {
            await db.query("ALTER TABLE memori ADD COLUMN user VARCHAR(100) AFTER id");
            console.log("✅ Migrasi Sukses: Kolom 'user' ditambahkan ke tabel memori.");
        } catch (err) {
            // Error 1060 = Duplicate column (Artinya kolom sudah ada, skip aja)
            if (err.errno !== 1060) console.error("Info Migrasi Memori:", err.message);
        }

        // 2. Cek & Tambah Kolom 'user_id' di tabel 'transaksi' (SOLUSI MASALAH LU)
        try {
            await db.query("ALTER TABLE transaksi ADD COLUMN user_id VARCHAR(50) AFTER id");
            console.log("✅ Migrasi Sukses: Kolom 'user_id' ditambahkan ke tabel transaksi.");
        } catch (err) {
            if (err.errno !== 1060) console.error("Info Migrasi Transaksi:", err.message);
        }

        console.log("✅ Database Siap & Ter-update.");
    } catch (e) {
        console.error("❌ Gagal Init DB:", e.message);
    }
};

module.exports = db;