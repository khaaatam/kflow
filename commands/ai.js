const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // --- FITUR 1: !INGAT (NAMBAH MEMORI) ---
    if (text.startsWith('!ingat')) {
        const faktaBaru = msg.body.replace(/!ingat/i, '').trim();
        if (!faktaBaru) return client.sendMessage(chatDestination, "apa yang harus gw inget? contoh: `!ingat tami alergi udang`");

        db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], (err) => {
            if (err) return client.sendMessage(chatDestination, "gagal simpen ke otak: " + err.message);
            client.sendMessage(chatDestination, "oke, udah gw inget.");
        });
        return;
    }

    // --- FITUR 2: !AI / !ANALISA (TANYA JAWAB) ---
    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        const promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();
        if (!promptUser) return client.sendMessage(chatDestination, "nanya apa?");

        await msg.react('🤖');

        // Step 1: Ambil Memori (Fakta Penting)
        const getMemori = new Promise((resolve) => {
            db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 5", (err, rows) => resolve(err ? [] : rows));
        });

        // Step 2: Ambil History Chat (Buat Niru Gaya Bicara)
        // Kita ambil agak banyak (30) biar dia punya banyak referensi gaya ketikan lu
        const getChatLogs = new Promise((resolve) => {
            db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 30", (err, rows) => {
                if (err || !rows) return resolve([]);
                resolve(rows.reverse());
            });
        });

        const [memoriData, chatData] = await Promise.all([getMemori, getChatLogs]);

        const textMemori = memoriData.map(m => `- ${m.fakta}`).join("\n");
        // Kita format history biar AI tau mana Tami mana Dini
        const textHistory = chatData.map(c => `${c.nama_pengirim}: ${c.pesan}`).join("\n");

        // --- PROMPT BARU (HUMANIZED) ---
        const finalPrompt = `
        Role: Kamu adalah teman dekat dari Tami dan Dini. BUKAN asisten, BUKAN robot.
        Nama kamu: K-Bot (tapi gak usah sering-sering sebut nama).
        
        Tugas: Jawab pertanyaan dari ${namaPengirim}.
        
        Aturan Gaya Bicara (WAJIB):
        1. JANGAN PAKE FORMAT BOLD ATAU ITALIC (jangan pake tanda bintang * sama sekali). 
        2. Tiru gaya ketikan user dari [History Chat] di bawah (perhatikan singkatan, huruf kecil, dan cara mereka ngomong).
        3. Santai, singkat, padat. Jangan bertele-tele kayak artikel blog.
        4. Kalau user pake bahasa kasar/toxic dikit, bales santai aja, jangan kaku/sopan banget.
        5. Pake 'gw/lu' atau 'aku/kamu' tergantung lawan bicara pake apa di history.

        [Fakta yang lu tau tentang user]
        ${textMemori}

        [History Chat (CONTEK GAYA BICARA DARI SINI)]
        ${textHistory}
        
        [Pertanyaan Baru]
        ${namaPengirim}: ${promptUser}
        
        Jawab (langsung to the point, tanpa basa-basi robot):
        `;

        try {
            const result = await model.generateContent(finalPrompt);
            const response = await result.response;
            let cleanResponse = response.text();

            // --- FILTER PEMBERSIH ---
            // 1. Hapus semua tanda bintang (*) biar gak jadi bold/italic sampah
            cleanResponse = cleanResponse.replace(/\*/g, '');
            // 2. Hapus markdown bold markdown (**)
            cleanResponse = cleanResponse.replace(/\*\*/g, '');
            // 3. (Opsional) Paksa huruf kecil semua biar kerasa 'chatting'
            cleanResponse = cleanResponse.toLowerCase();

            await client.sendMessage(chatDestination, cleanResponse.trim());
        } catch (error) {
            console.error("ai error:", error);
            await client.sendMessage(chatDestination, "duh, otak gw nge-bug bentar.");
        }
    }
};