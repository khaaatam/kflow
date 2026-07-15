CREATE TABLE IF NOT EXISTS full_chat_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_pengirim VARCHAR(100),
    pesan TEXT,
    is_forwarded BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaksi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    jenis ENUM('pemasukan', 'pengeluaran'),
    nominal BIGINT,
    keterangan TEXT,
    sumber VARCHAR(50) DEFAULT 'WhatsApp',
    tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memori (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user VARCHAR(100),
    fakta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama_event VARCHAR(255),
    tanggal DATE,
    dibuat_oleh VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_instruction (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instruction TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    pesan TEXT,
    waktu_eksekusi TIMESTAMP,
    status ENUM('pending', 'done') DEFAULT 'pending'
);
