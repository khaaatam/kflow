const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    if (!text.toLowerCase().startsWith('!tami')) return false;

    let userProblem = text.replace('!tami', '').trim();
    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        userProblem = `(Ngebales chat: "${quoted.body}")\n\nIsi balesan gw: ${userProblem}`;
    }

    try {
        // 1. TARIK SAMPEL YANG LEBIH VARIATIF
        // Ambil 60 sampel acak biar AI punya banyak referensi gaya
        const [rowsSample] = await db.query(`
            SELECT pesan FROM (
                SELECT pesan FROM full_chat_logs 
                WHERE nama_pengirim LIKE '%Tami%' 
                AND pesan NOT LIKE '!%' 
                AND is_forwarded = 0 
                AND LENGTH(pesan) > 3 
                ORDER BY id DESC LIMIT 600 
            ) AS subquery
            ORDER BY RAND() LIMIT 60 
        `);
        const tamiStyle = rowsSample.map(r => r.pesan).join("\n");

        // 2. KONTEKS 
        const [rowsContext] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 8");
        const chatContext = rowsContext.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        // 3. PROMPT SIMPLE (IMITASI MURNI)
        // Gak pake aturan ribet, biarin dia nyontek "vibe" dari sampel
        const prompt = `
        Kamu adalah Tami. Tugasmu membalas chat Dini.
        JANGAN JADI ROBOT. JANGAN JADI ASISTEN.

        Ini adalah contoh gaya ketikanmu (PERHATIKAN singkatan, huruf kecil, dan nada bicaranya):
        === CONTOH GAYA KETIKAN TAMI ===
        ${tamiStyle}
        ================================

        Sekarang balas chat ini sesuai gaya di atas:
        
        Konteks Obrolan (Hanya untuk referensi topik, JANGAN TERPAKU EMOSINYA):
        ${chatContext}

        Pesan TERBARU Dini (Fokus balas ini):
        "${userProblem}"

        Tami: (Langsung jawab isinya, tanpa tanda kutip)
        `;

        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();

        // --- POST PROCESSING (Pembersihan Wajib) ---
        // Kita bantu AI biar konsisten 100% gaya lu
        response = response.toLowerCase(); // Wajib huruf kecil
        response = response.replace(/"/g, '').replace(/'/g, ''); // Buang kutip
        if (response.endsWith('.')) response = response.slice(0, -1); // Buang titik akhir

        // Buang koma kalau user emang anti-koma
        response = response.replace(/,/g, '');

        await client.sendMessage(msg.from, response);

    } catch (error) {
        console.error("Cloning Error:", error);
    }
    return true;
};

module.exports.metadata = { category: "AI", commands: [{ command: '!tami', desc: 'Clone Tami' }] };