const db = require('../lib/database');

class Transaction {
    static async add(userId, jenis, nominal, keterangan, source = 'WhatsApp') {
        const sql = "INSERT INTO transaksi (user_id, jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?, ?)";
        await db.query(sql, [userId, jenis, nominal, keterangan, source]);
        return true;
    }

    static async getBalance() {
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

    // 👇 TAMBAHIN FUNGSI INI BUAT GRAFIK
    static async getStats() {
        const sql = `
            SELECT 
                SUM(CASE WHEN jenis = 'pemasukan' THEN nominal ELSE 0 END) as total_masuk, 
                SUM(CASE WHEN jenis = 'pengeluaran' THEN nominal ELSE 0 END) as total_keluar 
            FROM transaksi
        `;
        const [rows] = await db.query(sql);
        return rows[0]; // Isinya: { total_masuk: 50000, total_keluar: 20000 }
    }

    static async getRecent(limit = 5) {
        const sql = "SELECT * FROM transaksi ORDER BY created_at DESC LIMIT ?";
        const [rows] = await db.query(sql, [limit]);
        return rows;
    }
}

module.exports = Transaction;