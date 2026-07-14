const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const config = require('../config');
const logger = require('./logger');

const pool = mysql.createPool(config.database);
const db = pool.promise();

const migrationDir = path.join(__dirname, '../migrations');

const baseTables = [
    `CREATE TABLE IF NOT EXISTS full_chat_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_pengirim VARCHAR(100),
        pesan TEXT,
        is_forwarded BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS transaksi (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50),
        jenis ENUM('pemasukan', 'pengeluaran'),
        nominal BIGINT,
        keterangan TEXT,
        sumber VARCHAR(50) DEFAULT 'WhatsApp',
        tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS memori (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user VARCHAR(100),
        fakta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_event VARCHAR(255),
        tanggal DATE,
        dibuat_oleh VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS system_instruction (
        id INT AUTO_INCREMENT PRIMARY KEY,
        instruction TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50),
        pesan TEXT,
        waktu_eksekusi TIMESTAMP,
        status ENUM('pending', 'done') DEFAULT 'pending'
    )`
];

const ensureMigrationsTable = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

const columnExists = async (tableName, columnName) => {
    const [rows] = await db.query(
        `SELECT 1
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [config.database.database, tableName, columnName]
    );
    return rows.length > 0;
};

const indexExists = async (tableName, indexName) => {
    const [rows] = await db.query(
        `SELECT 1
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
         LIMIT 1`,
        [config.database.database, tableName, indexName]
    );
    return rows.length > 0;
};

const applyLegacyCompatibilityMigrations = async () => {
    const hasCreatedAt = await columnExists('full_chat_logs', 'created_at');
    const hasWaktu = await columnExists('full_chat_logs', 'waktu');

    if (!hasCreatedAt) {
        await db.query('ALTER TABLE full_chat_logs ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
        if (hasWaktu) {
            await db.query('UPDATE full_chat_logs SET created_at = waktu WHERE created_at IS NULL');
        }
    }

    if (!await columnExists('transaksi', 'user_id')) {
        await db.query('ALTER TABLE transaksi ADD COLUMN user_id VARCHAR(50) AFTER id');
    }
    if (!await columnExists('transaksi', 'sumber')) {
        await db.query("ALTER TABLE transaksi ADD COLUMN sumber VARCHAR(50) DEFAULT 'WhatsApp' AFTER keterangan");
    }
    if (!await columnExists('transaksi', 'tanggal')) {
        await db.query('ALTER TABLE transaksi ADD COLUMN tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER sumber');
    }
    await db.query("ALTER TABLE transaksi MODIFY COLUMN jenis ENUM('pemasukan', 'pengeluaran')");

    if (!await columnExists('memori', 'user')) {
        await db.query('ALTER TABLE memori ADD COLUMN user VARCHAR(100) AFTER id');
    }
};

const ensureIndexes = async () => {
    if (!await indexExists('full_chat_logs', 'idx_full_chat_logs_nama_pengirim')) {
        await db.query('CREATE INDEX idx_full_chat_logs_nama_pengirim ON full_chat_logs (nama_pengirim)');
    }
    if (!await indexExists('full_chat_logs', 'idx_full_chat_logs_created_at')) {
        await db.query('CREATE INDEX idx_full_chat_logs_created_at ON full_chat_logs (created_at)');
    }
    if (!await indexExists('events', 'idx_events_tanggal')) {
        await db.query('CREATE INDEX idx_events_tanggal ON events (tanggal)');
    }
};

const runMigrationFile = async (fileName) => {
    const migrationName = fileName.replace(/\.sql$/, '');
    const [rows] = await db.query('SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1', [migrationName]);
    if (rows.length > 0) return;

    const filePath = path.join(migrationDir, fileName);
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    const statements = sqlContent
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(Boolean);

    for (const statement of statements) {
        await db.query(statement);
    }

    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [migrationName]);
    logger.info(`Migration applied: ${migrationName}`);
};

const runMigrations = async () => {
    if (!fs.existsSync(migrationDir)) return;

    const files = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

    for (const file of files) {
        await runMigrationFile(file);
    }
};

db.init = async () => {
    logger.info('Cek Struktur Database...');
    try {
        for (const sql of baseTables) await db.query(sql);

        await ensureMigrationsTable();
        await runMigrations();
        await applyLegacyCompatibilityMigrations();
        await ensureIndexes();

        logger.info('Database Sinkron & Siap.');
    } catch (e) {
        logger.error('Gagal Init DB:', e.message);
    }
};

module.exports = db;
