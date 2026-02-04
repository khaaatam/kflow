const db = require('../lib/database');

class Transaction {
    // 1. Tambah Transaksi
    static async add(userId, jenis, nominal, keterangan, sumber = 'WhatsApp') {
        // Kolom 'tanggal' gak perlu diisi manual, otomatis dari database (CURRENT_TIMESTAMP)
        const sql = "INSERT INTO transaksi (user_id, jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?, ?)";
        await db.query(sql, [userId, jenis, nominal, keterangan, sumber]);
        return true;
    }

    // 2. Cek Saldo Total
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

    // 3. STATISTIK CUSTOM (Ganti created_at -> tanggal)
    static async getStatsCustom(startDate, endDate) {
        const sql = `
            SELECT 
                SUM(CASE WHEN jenis = 'pemasukan' THEN nominal ELSE 0 END) as total_masuk, 
                SUM(CASE WHEN jenis = 'pengeluaran' THEN nominal ELSE 0 END) as total_keluar 
            FROM transaksi 
            WHERE tanggal >= ? AND tanggal <= ?
        `;
        const [rows] = await db.query(sql, [startDate, endDate]);
        return rows[0];
    }

    // 4. LIST TRANSAKSI CUSTOM (Ganti created_at -> tanggal)
    static async getListCustom(startDate, endDate) {
        const sql = `
            SELECT * FROM transaksi 
            WHERE tanggal >= ? AND tanggal <= ? 
            ORDER BY tanggal DESC
        `;
        const [rows] = await db.query(sql, [startDate, endDate]);
        return rows;
    }

    // 5. Statistik Global
    static async getStats() {
        return this.getStatsCustom('2000-01-01 00:00:00', '2100-12-31 23:59:59');
    }

    // 6. History Terakhir
    static async getRecent(limit = 5) {
        const sql = "SELECT * FROM transaksi ORDER BY tanggal DESC LIMIT ?";
        const [rows] = await db.query(sql, [limit]);
        return rows;
    }
}

module.exports = Transaction;