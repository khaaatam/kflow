const config = require('../config');

module.exports = async (client, msg, text, db) => {
    // 1. CEK TRIGGER
    if (text.toLowerCase() !== '!stats') return false;

    // Gak perlu loading-loadingan, biar cepet sat-set

    // 2. HITUNG STATISTIK DINI (Chat Masuk Hari Ini)
    // Kita filter: nama_pengirim BUKAN Tami (atau siapapun nama user lu di config)
    // Jadi bot activity gak bakal keitung sama sekali.
    const statsHarian = await new Promise((resolve) => {
        const query = `
            SELECT 
                COUNT(*) as total_chat,
                SUM(CASE WHEN is_forwarded = 1 THEN 1 ELSE 0 END) as total_forward
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
            AND nama_pengirim NOT LIKE '%Tami%' 
        `;
        db.query(query, (err, rows) => {
            resolve(rows[0] || { total_chat: 0, total_forward: 0 });
        });
    });

    // 3. TOP BAWEL (Siapa yg paling sering ngechat lu hari ini?)
    const topUser = await new Promise((resolve) => {
        const query = `
            SELECT nama_pengirim, COUNT(*) as jumlah 
            FROM full_chat_logs 
            WHERE DATE(created_at) = CURDATE()
            AND nama_pengirim NOT LIKE '%Tami%' 
            GROUP BY nama_pengirim 
            ORDER BY jumlah DESC 
            LIMIT 1
        `;
        db.query(query, (err, rows) => {
            if (err || rows.length === 0) resolve({ nama_pengirim: 'Sepi banget...', jumlah: 0 });
            else resolve(rows[0]);
        });
    });

    // 4. KATA TRENDING (Dari chat orang lain ke lu)
    const topWord = await new Promise((resolve) => {
        const query = `
            SELECT pesan FROM full_chat_logs 
            WHERE nama_pengirim NOT LIKE '%Tami%' 
            ORDER BY id DESC LIMIT 100
        `;
        db.query(query, (err, rows) => {
            if (err || !rows) resolve("-");
            else {
                const allWords = rows.map(r => r.pesan).join(" ").toLowerCase();
                const words = allWords.replace(/[^\w\s]/g, "").split(/\s+/);

                const frequency = {};
                let maxCount = 0;
                let mostFreq = "-";
                // Kata sambung yg dibuang
                const stopWords = ['yg', 'yang', 'di', 'ke', 'ini', 'itu', 'dan', 'aku', 'kamu', 'gw', 'ya', 'ga', 'gk', 'ada', 'lagi', 'apa', 'sih', 'mau', 'udah', 'bisa', 'tapi', 'sama', 'dong', 'banget', 'aja', 'mah', 'kok'];

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

    // 5. KIRIM LAPORAN
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Kita kasih judul "INCOMING TRAFFIC" biar jelas ini statistik chat masuk
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
    return true;
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!stats', desc: 'Cek statistik chat masuk (Pure)' }
    ]
};