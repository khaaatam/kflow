const mysql = require('mysql2');
const config = require('../config');

// Bikin koneksi pool (biar gak putus nyambung)
const pool = mysql.createPool(config.database);

// Export mode Promise biar enak dipakenya
const db = pool.promise();

// --- FITUR AUTO-FIX DATABASE ---
db.init = async () => {
    console.log("🛠️  Sedang mengecek kelengkapan database...");

    try {
        // 1. Tabel Chat Logs (Buat !stats, !ayang, !saran)
        await db.query(`
            CREATE TABLE IF NOT EXISTS full_chat_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nama_pengirim VARCHAR(255),
                pesan TEXT,
                waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_forwarded TINYINT(1) DEFAULT 0
            )
        `);

        // 2. Tabel Memori AI (Buat !ingat)
        await db.query(`
            CREATE TABLE IF NOT EXISTS memori (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fakta TEXT
            )
        `);

        // 3. Tabel Persona AI (Buat !setpersona)
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_instruction (
                id INT AUTO_INCREMENT PRIMARY KEY,
                instruction TEXT,
                is_active TINYINT(1) DEFAULT 1
            )
        `);

        // 4. Tabel Keuangan (Buat !catat & Dashboard Web)
        await db.query(`
            CREATE TABLE IF NOT EXISTS transaksi (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(100),
                jenis ENUM('pemasukan', 'pengeluaran', 'masuk', 'keluar'),
                nominal BIGINT,
                keterangan TEXT,
                sumber VARCHAR(100) DEFAULT 'WhatsApp',
                tanggal DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 5. Tabel Events (Buat !event)
        await db.query(`
            CREATE TABLE IF NOT EXISTS events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nama_event VARCHAR(255),
                tanggal DATE,
                dibuat_oleh VARCHAR(100)
            )
        `);

        // 6. Isi Data Awal Persona (Kalo kosong doang)
        const [cekPersona] = await db.query("SELECT id FROM system_instruction LIMIT 1");
        if (cekPersona.length === 0) {
            await db.query("INSERT INTO system_instruction (instruction) VALUES (?)", [
                "Kamu adalah K-Flow, asisten pribadi Tami dan Dini yang santai, lucu, dan sangat membantu."
            ]);
            console.log("✅ Persona default berhasil ditanam.");
        }

        console.log("✅ Database aman & lengkap!");
    } catch (err) {
        console.error("❌ Gagal inisialisasi database:", err.message);
        console.error("⚠️  Pastikan lu udah bikin database kosongnya: 'CREATE DATABASE kflow_db;' di mysql termux.");
    }
};

module.exports = db;