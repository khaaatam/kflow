const ChatLog = require('../models/ChatLog');

module.exports = async (client, msg, args) => {
    try {
        const [statsHarian, topUser, recentMsgs] = await Promise.all([
            ChatLog.getDailyStats(),
            ChatLog.getTopUser(),
            ChatLog.getRecentMessages(100)
        ]);

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

        const reply = `📊 *STATISTIK CHAT HARI INI*\n📨 Total Chat: ${statsHarian.total_chat}\n🏆 Top Spam: **${topUser.nama_pengirim}** (${topUser.jumlah})\n🔥 Trending: "${topWord}"`;
        await client.sendMessage(msg.from, reply);

    } catch (err) {
        console.error("Stats Error:", err);
        msg.reply("❌ Gagal tarik data.");
    }
};
module.exports.metadata = { category: "LAINNYA", commands: [{ command: '!stats', desc: 'Statistik Chat Harian' }] };