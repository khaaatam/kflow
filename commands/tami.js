const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Init AI
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    // 1. CEK TRIGGER (!tami)
    if (!text.toLowerCase().startsWith('!tami')) return false;

    console.log("🧬 Command !tami (Digital Clone) activated.");
    await msg.react('😐'); // React datar (sesuai persona lu)

    // 2. TENTUKAN KONTEKS
    let userProblem = text.replace('!tami', '').trim();

    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        userProblem = `(Konteks chat lawan: "${quoted.body}")\n\nRespon gw: ${userProblem}`;
    }

    // 3. TARIK DATA GAYA BICARA TAMI (SAMPLE MURNI)
    // Kita ambil chat lu yang agak panjang biar AI bisa liat struktur kalimatnya
    const tamiStyle = await new Promise((resolve) => {
        const query = `
            SELECT pesan FROM (
                SELECT pesan FROM full_chat_logs 
                WHERE nama_pengirim LIKE '%Tami%' 
                AND pesan NOT LIKE '!%' 
                AND pesan NOT LIKE '⏳%' 
                AND pesan NOT LIKE 'Bot %'
                AND is_forwarded = 0 
                AND LENGTH(pesan) > 15 -- Ambil yg kalimat utuh
                ORDER BY id DESC LIMIT 300 
            ) AS subquery
            ORDER BY RAND() 
            LIMIT 30 -- Sample cukup 30 biar gk error 429
        `;
        db.query(query, (err, rows) => {
            if (err || !rows) resolve("");
            else resolve(rows.map(r => r.pesan).join("\n"));
        });
    });

    // 4. KONTEKS OBROLAN
    const chatContext = await new Promise((resolve) => {
        const query = "SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 10";
        db.query(query, (err, rows) => {
            if (err || !rows) resolve("");
            else resolve(rows.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n"));
        });
    });

    // 5. PROMPT "MIMICRY" (PENIRU ULUNG) 🎭
    const prompt = `
    PERINGATAN KERAS:
    Kamu BUKAN asisten AI. Kamu adalah **CLONE TEXT** dari TAMI.
    Tugasmu hanya satu: **MENIRU GAYA KETIKAN TAMI 100% PERSIS.**

    [DATA SAMPEL KETIKAN ASLI TAMI]:
    ---
    ${tamiStyle}
    ---

    [ATURAN PENIRUAN MUTLAK]:
    1. **ANALISA PENGGUNAAN EMOJI:**
       - LIHAT [DATA SAMPEL]. Apakah Tami sering pakai emoji?
       - JIKA TIDAK ADA EMOJI DI SAMPLE -> **JANGAN PERNAH PAKAI EMOJI.** (Haram hukumnya).
       - Tami itu orangnya flat/datar/teknis. Jangan sok asik pakai "wkwk" atau emoji kalau tidak ada di sample.

    2. **ANALISA SINGKATAN (TYPING QUIRKS):**
       - Perhatikan cara Tami menyingkat kata.
       - Contoh: "tidak" -> "gk", "engga" -> "ga", "sudah" -> "udh", "yang" -> "yg".
       - Gunakan huruf KECIL semua (lowercase) jika sample menunjukkan demikian.

    3. **TONE/NADA BICARA:**
       - Tami itu "Direct" (To the point). Tidak bertele-tele.
       - Jangan terlalu "lembut" atau "bucin" kalau sample-nya kaku.
       - Jawab sesingkat dan seefisien mungkin, khas programmer/cowok cuek.

    [KONTEKS OBROLAN SAAT INI]:
    ${chatContext}

    [INPUT/PERTANYAAN LAWAN BICARA]:
    "${userProblem}"

    INSTRUKSI OUTPUT:
    Jawab chat di atas sebagai Tami. HANYA TEKS JAWABAN. Tanpa basa-basi. Tanpa emoji (kecuali terpaksa).
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();

        // Hapus tanda kutip kalau AI bandel nambahin
        const finalResponse = response.replace(/^"|"$/g, '');

        await client.sendMessage(msg.from, finalResponse);

    } catch (error) {
        console.error("Cloning Error:", error);
    }

    return true;
};

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!tami', desc: 'Clone Tami (No Emoji Version)' }
    ]
};