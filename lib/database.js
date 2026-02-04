const mysql = require('mysql2');
const config = require('../config');

// Buat Pool Koneksi
const pool = mysql.createPool(config.database);
const db = pool.promise();

// 👇 FUNGSI INIT DATABASE (AUTO-FIXER)
db.init = async () => {
    console.log("🛠️ Cek Struktur Database...");
    try {
        // 1. Definisikan Tabel Ideal (Buat User Baru)
        const tables = [
            `CREATE TABLE IF NOT EXISTS full_chat_logs (id INT AUTO_INCREMENT PRIMARY KEY, nama_pengirim VARCHAR(100), pesan TEXT, is_forwarded BOOLEAN DEFAULT 0, waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS transaksi (id INT AUTO_INCREMENT PRIMARY KEY, user_id VARCHAR(50), jenis ENUM('pemasukan', 'pengeluaran'), nominal BIGINT, keterangan TEXT, sumber VARCHAR(50) DEFAULT 'WhatsApp', tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS memori (id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(100), fakta TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS events (id INT AUTO_INCREMENT PRIMARY KEY, nama_event VARCHAR(255), tanggal DATE, dibuat_oleh VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS system_instruction (id INT AUTO_INCREMENT PRIMARY KEY, instruction TEXT, is_active BOOLEAN DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
        ];

        for (const sql of tables) await db.query(sql);

        // ============================================================
        // 🚑 AUTO MIGRATION (PERBAIKAN STRUKTUR OTOMATIS)
        // ============================================================

        try {
            await db.query("ALTER TABLE transaksi ADD COLUMN tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER sumber");
        } catch (e) { if (e.errno !== 1060) console.log("Info Tanggal:", e.message); }
        try {
            await db.query("ALTER TABLE memori ADD COLUMN user VARCHAR(100) AFTER id");
        }
        catch (e) { if (e.errno !== 1060) console.log("Info Memori:", e.message); }
        try {
            await db.query("ALTER TABLE transaksi ADD COLUMN user_id VARCHAR(50) AFTER id");
        }
        catch (e) { if (e.errno !== 1060) console.log("Info Transaksi ID:", e.message); }
        try {
            await db.query("ALTER TABLE transaksi ADD COLUMN sumber VARCHAR(50) DEFAULT 'WhatsApp' AFTER keterangan");
        } catch (e) {
            if (e.errno !== 1060) console.log("Info Transaksi Sumber:", e.message);
        }
        try {
            await db.query("ALTER TABLE transaksi MODIFY COLUMN jenis ENUM('pemasukan', 'pengeluaran')");
        } catch (e) { console.error("Info Fix Jenis:", e.message); }

        console.log("✅ Database Sinkron & Siap.");
    } catch (e) {
        console.error("❌ Gagal Init DB:", e.message);
    }
};

module.exports = db;