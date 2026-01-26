const config = require('../config');

module.exports = async (client, msg, text, db) => {
    // 1. HITUNG TOTAL CHAT HARI INI
    // Kita pake fungsi SQL DATE() buat ngefilter tanggal hari ini
    const statsHarian = await new Promise((resolve) => {
        const query = `
            SELECT 
                COUNT(*) as total_chat,
                SUM(CASE WHEN is_forwarded = 1 THEN 1 ELSE 0 END) as total_forward
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
        `;
        db.query(query, (err, rows) => {
            if (err) resolve({ total_chat: 0, total_forward: 0 });
            else resolve(rows[0]);
        });
    });

    // 2. SIAPA YANG PALING BAWEL HARI INI? (Top User)
    const topUser = await new Promise((resolve) => {
        const query = `
            SELECT nama_pengirim, COUNT(*) as jumlah 
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
            GROUP BY nama_pengirim 
            ORDER BY jumlah DESC 
            LIMIT 1
        `;
        db.query(query, (err, rows) => {
            if (err || rows.length === 0) resolve({ nama_pengirim: 'Belum ada', jumlah: 0 });
            else resolve(rows[0]);
        });
    });

    // 3. ANALISA KATA (Word Cloud Sederhana)
    // Kita cari kata apa yang sering keluar di 50 chat terakhir
    const topWord = await new Promise((resolve) => {
        db.query("SELECT pesan FROM full_chat_logs ORDER BY id DESC LIMIT 50", (err, rows) => {
            if (err || !rows) resolve("-");
            else {
                const allWords = rows.map(r => r.pesan).join(" ").toLowerCase();
                // Buang simbol & split jadi array
                const words = allWords.replace(/[^\w\s]/g, "").split(/\s+/);

                // Hitung frekuensi
                const frequency = {};
                let maxCount = 0;
                let mostFreq = "-";

                // Filter kata sambung gak penting
                const stopWords = ['yg', 'yang', 'di', 'ke', 'ini', 'itu', 'dan', 'aku', 'kamu', 'gw', 'ya', 'ga', 'gk', 'ada', 'lagi'];

                words.forEach(w => {
                    if (w.length > 2 && !stopWords.includes(w)) {
                        frequency[w] = (frequency[w] || 0) + 1;
                        if (frequency[w] > maxCount) {
                            maxCount = frequency[w];
                            mostFreq = w;
                        }
                    }
                });
                resolve(`${mostFreq} (${maxCount}x)`);
            }
        });
    });

    // FORMAT LAPORAN
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const reply = `
📊 *STATISTIK CHAT HARI INI* ⏰ Update: ${now} WIB

💬 *Total Chat Masuk:* ${statsHarian.total_chat} bubble
↪️ *Total Forward:* ${statsHarian.total_forward} bubble

🏆 *Top Global Chat:*
👑 **${topUser.nama_pengirim}** (${topUser.jumlah} chat)
_(Si paling bawel hari ini)_

🔥 *Kata Trending (Top 50 chat):*
"${topWord}"

_Data diambil dari database 'full_chat_logs'._
`;

    await client.sendMessage(msg.from, reply);
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!stats', desc: 'Liat statistik siapa paling bawel' }
    ]
};