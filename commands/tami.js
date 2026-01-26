const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Init AI
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    // 1. CEK TRIGGER (!tami)
    // Bisa dipake di awal kalimat, atau buat reply
    if (!text.toLowerCase().startsWith('!tami')) return false;

    console.log("🧬 Command !tami (Digital Clone) activated.");
    await msg.react('🧬'); // Kasih reaksi biar tau lagi mikir

    // 2. TENTUKAN KONTEKS MASALAH (INPUT)
    let userProblem = text.replace('!tami', '').trim();

    // Kalau Dini nge-reply chat dia sendiri pake !tami, ambil chat yang di-reply itu
    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        userProblem = `(Konteks dari chat sebelumnya: "${quoted.body}")\n\nRespon gw: ${userProblem}`;
    }

    if (userProblem.length < 2 && !msg.hasQuotedMsg) {
        return client.sendMessage(msg.from, "Kasih konteks dong. Misal: `!tami aku bingung nih` atau Reply chat kamu pake `!tami`.");
    }

    // 3. TARIK GAYA BICARA TAMI (VERSI HEMAT KUOTA) 📉
    const tamiStyle = await new Promise((resolve) => {
        const query = `
            SELECT pesan FROM (
                SELECT pesan FROM full_chat_logs 
                WHERE nama_pengirim LIKE '%Tami%' 
                AND pesan NOT LIKE '!%' 
                AND pesan NOT LIKE '⏳%' 
                AND pesan NOT LIKE 'Bot %' 
                AND is_forwarded = 0 
                AND LENGTH(pesan) > 10 
                ORDER BY id DESC LIMIT 200 -- Ambil dari pool 200 terakhir aja
            ) AS subquery
            ORDER BY RAND() 
            LIMIT 30 -- 👈 TURUNIN JADI 30 (Biar gak kena Limit 429)
        `;
        db.query(query, (err, rows) => {
            if (err || !rows) resolve("");
            else resolve(rows.map(r => r.pesan).join("\n"));
        });
    });

    // 4. TARIK KONTEKS OBROLAN TERAKHIR (Biar nyambung)
    const chatContext = await new Promise((resolve) => {
        const query = "SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 10";
        db.query(query, (err, rows) => {
            if (err || !rows) resolve("");
            else resolve(rows.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n"));
        });
    });

    // 5. RITUAL PEMANGGILAN ARWAH (PROMPT ENGINEERING) 🕯️
    const prompt = `
    INSTRUKSI SANGAT PENTING:
    Kamu sekarang adalah **TAMI** (Bukan AI, Bukan Asisten).
    Kamu adalah cowok programmer, pacar dari Dini, pengguna motor Vario KZR, dan anak magang di Truku.id.

    TUGAS:
    Respon chat dari Dini seolah-olah kamu adalah Tami asli yang sedang membalas pesan (mungkin Tami asli sedang tidur/sibuk).
    
    [DATA GAYA BICARA TAMI (STYLE REFERENCE)]
    Pelajari cara Tami mengetik dari sampel di bawah ini (perhatikan penggunaan kata 'gw', 'aku', singkatan, dan emosi):
    ---
    ${tamiStyle}
    ---

    [KONTEKS OBROLAN SAAT INI]
    ${chatContext}

    [PESAN / KELUHAN DINI]
    "${userProblem}"

    ATURAN ROLEPLAY (WAJIB):
    1. **GAYA BAHASA:** Gunakan gaya bahasa yang SAMA PERSIS dengan [DATA GAYA BICARA TAMI]. Gunakan huruf kecil semua (kecuali Tami suka kapital).
    2. **PERSONALITAS:** Tami itu logis (anak IT), solutif, kadang santai/lucu, tapi sangat peduli (protective) sama Dini.
    3. **JANGAN HALLUCINATE:** Jangan ngaku-ngaku AI. Kalau ditanya lagi apa, bilang aja lagi sibuk coding atau lagi istirahat (sesuai jam).
    4. **NO FORMALITY:** Jangan kaku. Jangan pakai bahasa baku.

    OUTPUT:
    Hanya teks balasan Tami. Tanpa tanda kutip, tanpa intro "Sebagai Tami...". Langsung jawabannya.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();

        // Kirim langsung seolah-olah itu Tami
        await client.sendMessage(msg.from, response);

    } catch (error) {
        console.error("Cloning Error:", error);
        await client.sendMessage(msg.from, "gagal loading otak gw. coba lagi.");
    }

    return true;
};

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!tami', desc: 'Panggil Clone Tami (Mode Auto-Pilot)' }
    ]
};