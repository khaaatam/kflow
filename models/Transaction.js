const db = require('../lib/database');

class Transaction {
    // 1. Tambah Transaksi
    static async add(userId, jenis, nominal, keterangan, source = 'WhatsApp') {
        // Pastikan kolom database 'sumber' sesuai dengan parameter
        const sql = "INSERT INTO transaksi (user_id, jenis, nominal, keterangan, sumber) VALUES (?, ?, ?, ?, ?)";
        await db.query(sql, [userId, jenis, nominal, keterangan, source]);
        return true;
    }

    // 2. Cek Saldo Total (Semua Waktu)
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

    // 3. STATISTIK CUSTOM (Range Tanggal) 📅
    // Ini otak dari fitur !laporan
    static async getStatsCustom(startDate, endDate) {
        const sql = `
            SELECT 
                SUM(CASE WHEN jenis = 'pemasukan' THEN nominal ELSE 0 END) as total_masuk, 
                SUM(CASE WHEN jenis = 'pengeluaran' THEN nominal ELSE 0 END) as total_keluar 
            FROM transaksi 
            WHERE created_at >= ? AND created_at <= ?
        `;
        // Query pake range tanggal
        const [rows] = await db.query(sql, [startDate, endDate]);
        return rows[0];
    }

    // 4. LIST TRANSAKSI CUSTOM (Range Tanggal) 📝
    static async getListCustom(startDate, endDate) {
        const sql = `
            SELECT * FROM transaksi 
            WHERE created_at >= ? AND created_at <= ? 
            ORDER BY created_at DESC
        `;
        const [rows] = await db.query(sql, [startDate, endDate]);
        return rows;
    }

    // 5. Statistik Global (Helper buat Grafik Total)
    static async getStats() {
        // Ambil semua data dari tahun 2000 sampe 2100 (Anggap aja seumur hidup)
        return this.getStatsCustom('2000-01-01 00:00:00', '2100-12-31 23:59:59');
    }

    // 6. Ambil History Terakhir (Limit)
    static async getRecent(limit = 5) {
        const sql = "SELECT * FROM transaksi ORDER BY created_at DESC LIMIT ?";
        const [rows] = await db.query(sql, [limit]);
        return rows;
    }
}

module.exports = Transaction;