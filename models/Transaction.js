const db = require('../lib/database');

class Transaction {
    static async add(userId, jenis, nominal, ket, sumber) {
        return db.query("INSERT INTO transaksi (user_id, jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?, ?)", [userId, jenis, nominal, ket, sumber]);
    }

    static async getBalance() {
        const [income] = await db.query("SELECT SUM(nominal) as total FROM transaksi WHERE jenis = 'pemasukan'");
        const [expense] = await db.query("SELECT SUM(nominal) as total FROM transaksi WHERE jenis = 'pengeluaran'");
        return (income[0].total || 0) - (expense[0].total || 0);
    }

    static async getRecent(limit = 5) {
        const [rows] = await db.query("SELECT * FROM transaksi ORDER BY created_at DESC LIMIT ?", [limit]);
        return rows;
    }
}
module.exports = Transaction;