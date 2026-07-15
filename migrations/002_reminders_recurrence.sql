CREATE TABLE IF NOT EXISTS reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    pesan TEXT,
    waktu_eksekusi TIMESTAMP,
    status ENUM('pending', 'done') DEFAULT 'pending',
    recurrence VARCHAR(20) DEFAULT NULL,
    next_time TIMESTAMP DEFAULT NULL
);
