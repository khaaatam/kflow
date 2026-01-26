const config = require('../config');

module.exports = async (client, msg, text, db) => {
    // 1. CEK TRIGGER (Wajib ada biar gak spam)
    if (text.toLowerCase() !== '!stats') return false;

    console.log("📊 Command !stats triggered by", msg.from); // Cek terminal lu, muncul ini gk?

    await client.sendMessage(msg.from, "⏳ Sebentar, lagi kalkulasi data...");

    // 2. HITUNG TOTAL CHAT HARI INI
    const statsHarian = await new Promise((resolve) => {
        // Pake IFNULL biar kalau kosong tetep return 0
        const query = `
            SELECT 
                COUNT(*) as total_chat,
                SUM(CASE WHEN is_forwarded = 1 THEN 1 ELSE 0 END) as total_forward
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
        `;
        db.query(query, (err, rows) => {
            if (err) {
                console.error("Error SQL Stats:", err); // Cek error SQL
                resolve({ total_chat: 0, total_forward: 0 });
            } else {
                resolve(rows[0] || { total_chat: 0, total_forward: 0 });
            }
        });
    });

    // 3. SIAPA YANG PALING BAWEL?
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

    // 4. WORD CLOUD (Cari kata populer)
    const topWord = await new Promise((resolve) => {
        // Ambil 100 chat terakhir biar datanya agak banyak
        db.query("SELECT pesan FROM full_chat_logs ORDER BY id DESC LIMIT 100", (err, rows) => {
            if (err || !rows) resolve("-");
            else {
                const allWords = rows.map(r => r.pesan).join(" ").toLowerCase();
                const words = allWords.replace(/[^\w\s]/g, "").split(/\s+/);

                const frequency = {};
                let maxCount = 0;
                let mostFreq = "-";

                // Kata yang di-ignore
                const stopWords = ['yg', 'yang', 'di', 'ke', 'ini', 'itu', 'dan', 'aku', 'kamu', 'gw', 'ya', 'ga', 'gk', 'ada', 'lagi', 'apa', 'sih', 'mau', 'udah', 'bisa'];

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

    // 5. KIRIM HASIL
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const reply = `
📊 *STATISTIK CHAT HARI INI* ⏰ Update: ${now} WIB

💬 *Total Chat:* ${statsHarian.total_chat}
↪️ *Forwarded:* ${statsHarian.total_forward}

🏆 *Top Bawel:*
👑 **${topUser.nama_pengirim}** (${topUser.jumlah} chat)

🔥 *Kata Trending (100 chat terakhir):*
"${topWord}"
`;

    await client.sendMessage(msg.from, reply);
    return true; // Return true biar loop di app.js berhenti
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!stats', desc: 'Liat statistik chat hari ini' }
    ]
};