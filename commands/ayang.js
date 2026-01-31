const db = require('../lib/database');
const ai = require('../lib/ai');

module.exports = async (client, msg, args, senderId, namaPengirim) => {
    try {
        await msg.react('🧐'); // Kasih reaksi lagi mikir

        // 1. AMBIL 30 CHAT TERAKHIR DARI DATABASE
        // Kita ambil semua chat (bukan cuma Dini) biar AI tau konteks percakapannya
        const [rows] = await db.query(
            "SELECT nama_pengirim, pesan, waktu FROM full_chat_logs ORDER BY id DESC LIMIT 30"
        );

        if (rows.length === 0) {
            return msg.reply("❌ Belum ada riwayat chat, bot gak bisa nerawang.");
        }

        // 2. FORMAT DATA BIAR DIBACA AI
        // Kita balik urutannya (Reverse) biar jadi Kronologis (Lama -> Baru)
        // Kita sertakan jam-nya biar AI tau itu chat kapan
        const chatHistory = rows.reverse()
            .map(r => {
                const jam = new Date(r.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return `[${jam}] ${r.nama_pengirim}: ${r.pesan}`;
            })
            .join('\n');

        // 3. PROMPT "DETEKTIF CINTA"
        const prompt = `
        Kamu adalah asisten pribadi yang bertugas memantau aktivitas "Ayang" (Pacar User, biasanya bernama Dini).
        
        Ini adalah transkrip 30 chat terakhir di WA:
        ------------------------------------------
        ${chatHistory}
        ------------------------------------------
        
        TUGAS KAMU:
        Analisa transkrip di atas dan simpulkan apa yang sedang dilakukan "Dini" (atau lawan bicara user) SAAT INI.
        
        ATURAN ANALISA:
        1. LIHAT JAM TERAKHIR: 
           - Jika chat terakhir sudah lebih dari 2 jam yang lalu, simpulkan dia "Tidur" atau "Lagi Sibuk/Di Jalan".
           - Jika baru saja (kurang dari 10 menit), berarti dia "Online".
        2. BACA KONTEKS:
           - Kalau dia bilang "pamit", "mau makan", "otw", percayai itu.
           - Kalau dia bales singkat/dingin, peringatkan user kalau dia mungkin lagi badmood.
        
        GAYA BAHASA:
        - Santai, lucu, kayak temen tongkrongan.
        - Langsung to the point (JANGAN bertele-tele).
        - Contoh: "Kayaknya Dini lagi tidur deh bang, chat terakhirnya udah 3 jam lalu soalnya."
        `;

        // 4. KIRIM KE GEMINI AI
        const result = await ai.generateContent(prompt);
        const response = result.response.text();

        // 5. JAWAB KE USER
        msg.reply(response);

    } catch (error) {
        console.error("Error Ayang:", error);
        msg.reply("❌ Gagal menerawang... AI lagi pusing.");
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!ayang', desc: 'Pantau aktivitas ayang' }
    ]
};