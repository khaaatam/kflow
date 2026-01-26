const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Init AI
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    // 1. CEK TRIGGER
    if (!text.toLowerCase().startsWith('!tami')) return false;

    await msg.react('😎');

    // 2. TENTUKAN KONTEKS
    let userProblem = text.replace('!tami', '').trim();
    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        userProblem = `(Konteks chat lawan: "${quoted.body}")\n\nRespon gw: ${userProblem}`;
    }

    // 3. TARIK SAMPLE CHAT TAMI (SUMBER BELAJAR)
    // Kita ambil 40 chat acak biar AI punya cukup data buat nebak pola singkatan lu
    const tamiStyle = await new Promise((resolve) => {
        const query = `
            SELECT pesan FROM (
                SELECT pesan FROM full_chat_logs 
                WHERE nama_pengirim LIKE '%Tami%' 
                AND pesan NOT LIKE '!%' 
                AND pesan NOT LIKE '⏳%' 
                AND pesan NOT LIKE 'Bot %'
                AND is_forwarded = 0 
                AND LENGTH(pesan) > 5 
                ORDER BY id DESC LIMIT 300 
            ) AS subquery
            ORDER BY RAND() 
            LIMIT 40 
        `;
        db.query(query, (err, rows) => {
            if (err || !rows) resolve("");
            else resolve(rows.map(r => r.pesan).join("\n"));
        });
    });

    // 4. KONTEKS OBROLAN TERAKHIR
    const chatContext = await new Promise((resolve) => {
        const query = "SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 10";
        db.query(query, (err, rows) => {
            if (err || !rows) resolve("");
            else resolve(rows.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n"));
        });
    });

    // 5. PROMPT "STYLE EXTRACTION" (OTAK UTAMA)
    const prompt = `
    Kamu adalah CLONE TEXT dari TAMI.
    Tugasmu: Balas pesan lawan bicara dengan meniru GAYA KETIKAN TAMI dari data sampel.

    [DATA SAMPEL CHAT ASLI TAMI]:
    ---
    ${tamiStyle}
    ---

    [INSTRUKSI ANALISA GAYA - WAJIB DIPATUHI]:
    1. **ANALISA SINGKATAN (AUTO-LEARN):** - Lihat sampel di atas! Bagaimana Tami menyingkat kata-kata umum?
       - Contoh: Cek apakah Tami menulis "yang" sebagai "yg"? "sudah" sebagai "udh"? "enggak" sebagai "gk/ga"?
       - **TIRU PERSIS** singkatan yang kamu temukan di sampel. Jangan pakai ejaan baku jika Tami tidak memakainya.
    
    2. **STRUKTUR KALIMAT:**
       - Tami tidak suka basa-basi. Langsung ke inti.
       - Tami jarang pakai tanda baca lengkap (titik/koma).
       - JANGAN PERNAH PAKAI EMOJI (Kecuali di sampel banyak emoji).

    [KONTEKS CHAT SAAT INI]:
    ${chatContext}

    [PESAN LAWAN]:
    "${userProblem}"

    Jawablah pesan lawan dengan gaya Tami yang sudah kamu pelajari dari sampel.
    HANYA TEKS JAWABAN.
    `;

    try {
        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();

        // --- ⚡ FILTER STRUKTUR (HARDCORE RULES) ⚡ ---
        // Kita cuma paksa struktur dasar (huruf kecil & tanda baca)
        // Masalah singkatan kata, kita percayakan ke AI yang udah baca sampel.
        response = paksaStrukturTami(response);

        await client.sendMessage(msg.from, response);

    } catch (error) {
        console.error("Cloning Error:", error);
    }

    return true;
};

// --- FUNGSI FORMATTING DASAR ---
// (Gak ada kamus kata lagi disini, murni formatting)
function paksaStrukturTami(text) {
    // 1. Paksa huruf kecil semua (Sesuai request lu)
    let clean = text.toLowerCase();

    // 2. Buang tanda kutip aneh dari output AI
    clean = clean.replace(/"/g, '').replace(/'/g, '');

    // 3. Buang koma (User bilang jarang pake koma)
    clean = clean.replace(/,/g, '');

    // 4. Buang titik di akhir kalimat
    if (clean.endsWith('.')) {
        clean = clean.slice(0, -1);
    }

    // 5. Buang spasi ganda
    clean = clean.replace(/\s+/g, ' ');

    return clean;
}

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!tami', desc: 'Clone Tami (Auto-Learn Style)' }
    ]
};