const db = require('../lib/database');

class ChatLog {
    // 1. Ambil History Chat (Buat AI Context)
    static async getHistory(limit = 10, excludeCommands = true) {
        let query = "SELECT nama_pengirim, pesan FROM full_chat_logs";
        if (excludeCommands) query += " WHERE pesan NOT LIKE '!%'";
        query += " ORDER BY id DESC LIMIT ?";

        const [rows] = await db.query(query, [limit]);
        return rows.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");
    }

    // 2. Ambil Statistik Harian (Buat !stats)
    static async getDailyStats() {
        const query = `
            SELECT 
                COUNT(*) as total_chat,
                SUM(CASE WHEN is_forwarded = 1 THEN 1 ELSE 0 END) as total_forward
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
            AND nama_pengirim NOT LIKE '%Tami%'
        `;
        const [rows] = await db.query(query);
        return rows[0] || { total_chat: 0, total_forward: 0 };
    }

    // 3. Ambil Top Bawel (Buat !stats)
    static async getTopUser() {
        const query = `
            SELECT nama_pengirim, COUNT(*) as jumlah 
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
            AND nama_pengirim NOT LIKE '%Tami%' 
            GROUP BY nama_pengirim 
            ORDER BY jumlah DESC 
            LIMIT 1
        `;
        const [rows] = await db.query(query);
        return rows.length > 0 ? rows[0] : { nama_pengirim: 'Sepi...', jumlah: 0 };
    }

    // 4. Ambil 100 Pesan Terakhir (Buat Trending Word)
    static async getRecentMessages(limit = 100) {
        const [rows] = await db.query("SELECT pesan FROM full_chat_logs WHERE nama_pengirim NOT LIKE '%Tami%' ORDER BY id DESC LIMIT ?", [limit]);
        return rows;
    }
}

module.exports = ChatLog;