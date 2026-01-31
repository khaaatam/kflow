const db = require('../lib/database');
const ai = require('../lib/ai');
const config = require('../config');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    // 🔥 SECURITY CHECK: CUMA NOMOR TERDAFTAR DI CONFIG.JS
    // Kalau nomor pengirim GAK ADA di daftar 'config.users', tendang!
    if (!config.users[senderId]) {
        return msg.reply("sapa lu? gw cuma mau ngomong sama cewe gw atau temen deket gw. gausah sksd.");
    }

    try {
        // Bersihkan command
        const input = text.replace(/^!tami\s*/i, '').trim();

        if (!input) {
            return msg.reply("ngomong apa? ketik yg jelas.");
        }

        await msg.react('🧠');

        // 1. AMBIL DATABASE CHAT (BUAT BELAJAR GAYA TAMI)
        // Ambil chat dari Tami/JikaeL buat jadi referensi gaya bicara
        const [logs] = await db.query(
            "SELECT pesan FROM full_chat_logs WHERE nama_pengirim LIKE '%Tami%' OR nama_pengirim LIKE '%JikaeL%' ORDER BY id DESC LIMIT 50"
        );

        let learningMaterial = "";
        if (logs.length > 0) {
            learningMaterial = logs.reverse().map(r => r.pesan).join("\n- ");
        }

        // 2. RAKIT PROMPT MIMICRY (PERSONA TAMI)
        const prompt = `
        INSTRUKSI UTAMA:
        Kamu adalah TAMI (alias JikaeL). Kamu sedang chat dengan ${namaPengirim}.
        Tugasmu: Jawab chat ini dengan meniru gaya bicara, emosi, dan ketikan Tami 100%.

        CONTOH GAYA BICARA TAMI (SUMBER DATA ASLI):
        ------------------------------------------------
        - ${learningMaterial}
        ------------------------------------------------

        PROFIL KAMU:
        - Nama: Tami (JikaeL).
        - Status: Pacar Dini (Sayang tapi cool/gengsi).
        - Hobi: Coding, Termux, Motor Vario KZR.
        - Gaya Chat: Lowercase (huruf kecil), santai, kadang sarkas/lucu.
        
        PERTANYAAN USER (${namaPengirim}): "${input}"

        JAWAB SEBAGAI TAMI:
        (Jawab singkat, natural, lowercase, jangan kaku kaya robot)
        `;

        // 3. GENERATE JAWABAN
        const result = await ai.generateContent(prompt);
        let replyText = result.response.text();

        // Paksa huruf kecil biar otentik
        msg.reply(replyText.toLowerCase());

    } catch (error) {
        console.error("Error Tami Mimicry:", error);
        msg.reply("otak gw lagi nge-bug bentar.");
    }
};

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!tami', desc: 'Tami Mimicry' }
    ]
};