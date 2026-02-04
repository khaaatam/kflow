const db = require('../lib/database');

class Transaction {
    // 1. Tambah Transaksi (Tetep butuh userId buat history)
    static async add(userId, jenis, nominal, keterangan, source = 'WhatsApp') {
        const sql = "INSERT INTO transaksi (user_id, jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?, ?)";
        await db.query(sql, [userId, jenis, nominal, keterangan, source]);
        return true;
    }

    // 2. Cek Saldo (GLOBAL / JOINT ACCOUNT)
    // Hapus parameter 'userId' dan hapus 'WHERE user_id'
    static async getBalance() {
        // Rumus: Total Pemasukan - Total Pengeluaran (Semua User)
        const sql = `
            SELECT 
                SUM(CASE WHEN jenis = 'pemasukan' THEN nominal ELSE 0 END) - 
                SUM(CASE WHEN jenis = 'pengeluaran' THEN nominal ELSE 0 END) 
            AS saldo 
            FROM transaksi
        `;

        const [rows] = await db.query(sql);
        return rows[0].saldo || 0;
    }

    // 3. (Opsional) Liat History Terakhir (Bisa liat punya berdua)
    static async getRecent(limit = 5) {
        const sql = "SELECT * FROM transaksi ORDER BY created_at DESC LIMIT ?";
        const [rows] = await db.query(sql, [limit]);
        return rows;
    }
}

module.exports = Transaction;