const config = require('../config');

module.exports = async (client, msg, text, db) => {
    // 1. CEK TRIGGER
    if (text.toLowerCase() !== '!stats') return false;

    try {
        // 2. HITUNG STATISTIK DINI (Chat Masuk Hari Ini)
        const [rowsHarian] = await db.query(`
            SELECT 
                COUNT(*) as total_chat,
                SUM(CASE WHEN is_forwarded = 1 THEN 1 ELSE 0 END) as total_forward
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
            AND nama_pengirim NOT LIKE '%Tami%' 
        `);
        const statsHarian = rowsHarian[0] || { total_chat: 0, total_forward: 0 };

        // 3. TOP BAWEL
        const [rowsUser] = await db.query(`
            SELECT nama_pengirim, COUNT(*) as jumlah 
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
            AND nama_pengirim NOT LIKE '%Tami%' 
            GROUP BY nama_pengirim 
            ORDER BY jumlah DESC 
            LIMIT 1
        `);
        const topUser = rowsUser.length > 0 ? rowsUser[0] : { nama_pengirim: 'Sepi banget...', jumlah: 0 };

        // 4. KATA TRENDING
        const [rowsWord] = await db.query(`
            SELECT pesan FROM full_chat_logs 
            WHERE nama_pengirim NOT LIKE '%Tami%' 
            ORDER BY id DESC LIMIT 100
        `);

        let topWord = "-";
        if (rowsWord.length > 0) {
            const allWords = rowsWord.map(r => r.pesan).join(" ").toLowerCase();
            const words = allWords.replace(/[^\w\s]/g, "").split(/\s+/);
            const frequency = {};
            let maxCount = 0;
            const stopWords = ['yg', 'yang', 'di', 'ke', 'ini', 'itu', 'dan', 'aku', 'kamu', 'gw', 'ya', 'ga', 'gk', 'ada', 'lagi', 'apa', 'sih', 'mau', 'udah', 'bisa', 'tapi', 'sama', 'dong', 'banget', 'aja', 'mah', 'kok', 'di'];

            words.forEach(w => {
                if (w.length > 2 && !stopWords.includes(w)) {
                    frequency[w] = (frequency[w] || 0) + 1;
                    if (frequency[w] > maxCount) {
                        maxCount = frequency[w];
                        topWord = `${w} (${maxCount}x)`;
                    }
                }
            });
        }

        // 5. KIRIM LAPORAN
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const reply = `
📊 *STATISTIK CHAT MASUK HARI INI*
(Activity Orang Lain ke Tami)
⏰ ${now} WIB

📨 *Total Chat Masuk:* ${statsHarian.total_chat}
↪️ *Total Forward:* ${statsHarian.total_forward}

🏆 *Top Spam:*
👑 **${topUser.nama_pengirim}** (${topUser.jumlah} chat)

🔥 *Topik Mereka:*
"${topWord}"
`;
        await client.sendMessage(msg.from, reply);

    } catch (err) {
        console.error("Stats Error:", err);
        await client.sendMessage(msg.from, "❌ Gagal tarik data statistik.");
    }

    return true;
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!stats', desc: 'Cek statistik chat masuk (Pure)' }
    ]
};