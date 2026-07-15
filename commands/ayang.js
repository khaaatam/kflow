const db = require('../lib/database');
const ai = require('../lib/ai');
const config = require('../config');
const logger = require('../lib/logger');
const react = require('../lib/react');

module.exports = async (client, msg, args, senderId, _namaPengirim) => {
    try {
        // 1. CEK IDENTITAS PENGIRIM DARI CONFIG
        // Kita cocokin senderId sama daftar di config.users
        const senderName = config.users[senderId];

        if (!senderName) {
            return msg.reply("⚠️ Lu siapa? Fitur ini cuma buat Tami & Dini.");
        }

        // 2. TENTUKAN TARGET OPERASI (OTOMATIS TUKAR PERAN)
        let targetName = "";

        if (senderName.includes('Tami')) {
            // Kalau Tami yang nanya -> Cari Dini
            targetName = "Dini";
        } else if (senderName.includes('Dini')) {
            // Kalau Dini yang nanya -> Cari Tami
            targetName = "Tami";
        } else {
            return msg.reply("❌ Identitas tidak dikenali di skenario percintaan ini.");
        }

        await react(msg, '🔍');

        // 3. AMBIL CHAT SI TARGET DARI DATABASE
        // Pake LIKE biar fleksibel (misal: "Tami (Ganteng)", "Dini (Sayang)")
        const [rows] = await db.query(
            `SELECT nama_pengirim, pesan, created_at FROM full_chat_logs 
             WHERE nama_pengirim LIKE ? 
             ORDER BY id DESC LIMIT 20`,
            [`%${targetName}%`]
        );

        if (rows.length === 0) {
            return msg.reply(`❌ Belum ada riwayat chat dari ${targetName} di database.`);
        }

        // 4. FORMAT DATA
        const chatHistory = rows.reverse()
            .map(r => {
                const jam = new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return `[${jam}] ${r.nama_pengirim}: ${r.pesan}`;
            })
            .join('\n');

        // 5. PROMPT AI (ANALISA STATUS)
        const prompt = `
        PERAN: Kamu adalah asisten pribadi pasangan ini.
        USER YANG BERTANYA: ${senderName}
        TARGET YANG DIKEPOIN: ${targetName}
        
        DATA CHAT TERAKHIR DARI ${targetName}:
        -----------------------------
        ${chatHistory}
        -----------------------------
        
        TUGAS:
        Beritahu ${senderName} apa yang sedang dilakukan ${targetName} sekarang berdasarkan chat di atas.
        
        ANALISA:
        1. Cek Jam Chat Terakhir:
           - Kalau sudah lama (> 2 jam): Bilang dia mungkin "Tidur", "Sibuk", atau "Di Jalan".
           - Kalau baru saja: Bilang "Lagi Online".
        2. Cek Isi Chat:
           - Baca mood-nya. Apakah dia lagi manja, marah, capek, atau seneng?
           - Apakah dia bilang pamit (misal: "mandi dlu", "otw")?
        
        GAYA BICARA:
        - Jawab ke ${senderName} dengan santai (gw/lu/aku/kamu bebas asal akrab).
        - Contoh ke Tami: "Dini lagi bobo tuh bang, chat terakhirnya pamit tidur jam 10 malem."
        - Contoh ke Dini: "Si Tami lagi ngoding kayaknya Din, dia lagi on fire barusan."
        `;

        const result = await ai.generateContent(prompt);
        await react(msg, '✅');
        await msg.reply(result.response.text());

    } catch (error) {
        logger.error("Error Ayang:", error);
        await msg.reply("❌ Error, detektif cinta lagi pusing.");
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!ayang', desc: 'Cek kondisi ayang' }
    ]
};