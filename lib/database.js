const mysql = require('mysql2');
const config = require('../config');

const pool = mysql.createPool(config.database);
const db = pool.promise();

// 👇 FUNGSI INIT YANG ILANG
db.init = async () => {
    console.log("🛠️ Cek Tabel Database...");
    try {
        const tables = [
            `CREATE TABLE IF NOT EXISTS full_chat_logs (id INT AUTO_INCREMENT PRIMARY KEY, nama_pengirim VARCHAR(100), pesan TEXT, is_forwarded BOOLEAN DEFAULT 0, waktu TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS transaksi (id INT AUTO_INCREMENT PRIMARY KEY, user_id VARCHAR(50), jenis ENUM('pemasukan', 'pengeluaran'), nominal BIGINT, keterangan TEXT, sumber VARCHAR(50) DEFAULT 'WhatsApp', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS memori (id INT AUTO_INCREMENT PRIMARY KEY, fakta TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS events (id INT AUTO_INCREMENT PRIMARY KEY, nama_event VARCHAR(255), tanggal DATE, dibuat_oleh VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS system_instruction (id INT AUTO_INCREMENT PRIMARY KEY, instruction TEXT, is_active BOOLEAN DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
        ];

        for (const sql of tables) await db.query(sql);
        console.log("✅ Database Siap.");
    } catch (e) {
        console.error("❌ Gagal Init DB:", e.message);
    }
};

module.exports = db;