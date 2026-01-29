const ChatLog = require('../models/ChatLog'); // Pake Model ChatLog

module.exports = async (client, msg, args) => {
    // Cek command manual (karena ini file command, text 'args' itu array kata setelah command)
    // Tapi karena logic lama lu ngecek '!stats' explicitly, kita sesuaikan handler baru:
    // (Handler baru lu nanti bakal otomatis manggil file ini kalau user ketik !stats)

    try {
        // 1. Panggil Data dari Model (Parallel biar cepet)
        const [statsHarian, topUser, recentMsgs] = await Promise.all([
            ChatLog.getDailyStats(),
            ChatLog.getTopUser(),
            ChatLog.getRecentMessages(100)
        ]);

        // 2. Logic Hitung Trending Word (Tetep di sini karena ini logic tampilan)
        let topWord = "-";
        if (recentMsgs.length > 0) {
            const allWords = recentMsgs.map(r => r.pesan).join(" ").toLowerCase();
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

        // 3. Kirim Reply
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const reply = `
📊 *STATISTIK CHAT HARI INI*
⏰ ${now} WIB

📨 *Total Chat:* ${statsHarian.total_chat}
↪️ *Total Forward:* ${statsHarian.total_forward}

🏆 *Top Spam:*
👑 **${topUser.nama_pengirim}** (${topUser.jumlah} chat)

🔥 *Trending Word:*
"${topWord}"
`;
        await client.sendMessage(msg.from, reply);

    } catch (err) {
        console.error("Stats Error:", err);
        msg.reply("❌ Gagal tarik data.");
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [{ command: '!stats', desc: 'Statistik Chat Harian' }]
};