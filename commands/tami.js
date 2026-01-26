const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    if (!text.toLowerCase().startsWith('!tami')) return false;

    // Gak usah react emot, biar makin misterius/cuek (opsional)
    // await msg.react('😎'); 

    let userProblem = text.replace('!tami', '').trim();
    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        userProblem = `(Konteks: "${quoted.body}")\n\nRespon: ${userProblem}`;
    }

    try {
        // 1. TARIK SAMPEL (Lebih banyak dikit biar AI makin paham pola)
        const [rowsSample] = await db.query(`
            SELECT pesan FROM (
                SELECT pesan FROM full_chat_logs 
                WHERE nama_pengirim LIKE '%Tami%' 
                AND pesan NOT LIKE '!%' 
                AND is_forwarded = 0 
                AND LENGTH(pesan) > 2 
                ORDER BY id DESC LIMIT 500 
            ) AS subquery
            ORDER BY RAND() LIMIT 50 
        `);

        // Gabungin sampel jadi satu blok teks
        const tamiStyle = rowsSample.map(r => r.pesan).join("\n");

        // 2. KONTEKS TERAKHIR
        const [rowsContext] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 10");
        const chatContext = rowsContext.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        // 3. PROMPT "GALAK" (STRICT MODE)
        const prompt = `
        ROLEPLAY: Kamu adalah user WhatsApp bernama "Tami".
        Tugas: Balas pesan lawan bicara dengan gaya yang 100% PERSIS dengan sampel chat asli di bawah.

        [SAMPEL GAYA CHAT ASLI TAMI]:
        ${tamiStyle}

        [KONTEKS OBROLAN SAAT INI]:
        ${chatContext}

        [PESAN LAWAN]:
        "${userProblem}"

        [ATURAN KERAS / STRICT RULES - WAJIB PATUH]:
        1. JANGAN gunakan EMOJI sama sekali (kecuali di sampel chat banyak emoji, tapi prioritas TANPA emoji).
        2. JANGAN gunakan tanda baca formal. BUANG semua KOMA (,) dan TITIK (.).
        3. JANGAN gunakan huruf besar. Tulis semuanya dalam HURUF KECIL (lowercase).
        4. GUNAKAN SINGKATAN KHAS INDONESIA: 
           - "yang" -> "yg"
           - "enggak/tidak" -> "gk" / "ga"
           - "sudah" -> "udh"
           - "banget" -> "bgt"
           - "sama" -> "sm"
           - "aku/saya" -> "gw"
           - "kamu/anda" -> "lu"
        5. JANGAN terlalu panjang. Jawab singkat, padat, to the point.
        6. JANGAN terdengar seperti asisten AI atau robot. Jadilah manusia yang santai dan agak cuek.

        Balas langsung tanpa basa-basi:
        `;

        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();

        // --- POST PROCESSING (Pembersihan Manual) ---
        // 1. Paksa huruf kecil
        response = response.toLowerCase();

        // 2. Buang tanda kutip
        response = response.replace(/"/g, '').replace(/'/g, '');

        // 3. Buang Koma dan Titik di akhir (Sesuai request lu)
        response = response.replace(/,/g, '');
        if (response.endsWith('.')) response = response.slice(0, -1);

        // 4. Normalisasi spasi
        response = response.replace(/\s+/g, ' ');

        await client.sendMessage(msg.from, response);

    } catch (error) {
        console.error("Cloning Error:", error);
    }
    return true;
};

module.exports.metadata = { category: "AI", commands: [{ command: '!tami', desc: 'Clone Tami (Real Style)' }] };