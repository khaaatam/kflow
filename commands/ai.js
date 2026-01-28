const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Kita pake model sesuai pilihan lu di config.js (Gemini 2.5 Flash Lite)
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- OBSERVER (Auto Learn) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;
    // Filter: Abaikan pesan pendek
    if (text.length < 5 || text.split(' ').length < 2) return;

    // Trigger words tetap
    const triggerWords = ['aku', 'gw', 'saya', 'suka', 'benci', 'pengen', 'mau', 'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur', 'jangan', 'kecewa', 'senang', 'marah', 'sedih'];
    if (!triggerWords.some(word => text.toLowerCase().includes(word))) return;

    try {
        const [rowsChat] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 10");
        const contextHistory = rowsChat.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        const [rowsMem] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 30");
        const existingFacts = rowsMem.map(r => `- ${r.fakta}`).join("\n");

        const promptObserver = `
        Tugas: Ekstrak FAKTA BARU & PERMANEN tentang ${namaPengirim} dari chat terakhir.
        [DATABASE FAKTA LAMA]:
        ${existingFacts}
        [CHAT TERAKHIR]:
        ${contextHistory}
        User: "${text}"
        ATURAN:
        - Hanya catat info PENTING: Nama, Tanggal Lahir, Hobi, Tempat Tinggal, Status Hubungan.
        - Output format: [[SAVEMEMORY: Isi Fakta]]
        - Jika tidak ada fakta penting baru, output: KOSONG
        `;

        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();
        const match = response.match(/\[\[SAVEMEMORY:\s*(.*?)\]\]/);

        if (match && match[1]) {
            let memory = match[1].trim();
            const blacklist = ['lagi', 'sedang', 'akan', 'barusan', 'tadi', 'mungkin', '?'];
            if (blacklist.some(b => memory.toLowerCase().includes(b))) return;

            const [duplikat] = await db.query("SELECT id FROM memori WHERE fakta LIKE ?", [`%${memory}%`]);

            // --- FIX BUG LUPA INSERT ---
            if (duplikat.length === 0) {
                // 1. Simpan ke Database DULU (Wajib!)
                await db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

                // 2. Baru Lapor ke WA
                console.log(`🧠 [MEMORI] ${memory}`);
                if (config.system?.logNumber) {
                    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    await client.sendMessage(config.system.logNumber, `📝 *MEMORI BARU* [${now}]\n"${memory}"`);
                }
            }
        }
    } catch (e) { }
};

// --- INTERACT (!ai) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    if (text.startsWith('!ingat ')) {
        const fakta = msg.body.replace(/!ingat/i, '').trim();
        await db.query("INSERT INTO memori (fakta) VALUES (?)", [fakta]);
        return client.sendMessage(chatDestination, `✅ Oke, gw catet: "${fakta}"`);
    }

    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        let promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();
        let imagePart = null;

        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.mimetype.startsWith('image/')) {
                    imagePart = { inlineData: { data: media.data, mimeType: media.mimetype } };
                    if (!promptUser) promptUser = "Jelasin gambar ini";
                }
            } catch (e) { return client.sendMessage(chatDestination, "❌ Gagal baca gambar."); }
        }
        if (!promptUser && !imagePart) return client.sendMessage(chatDestination, "Mau diskusi apa?");

        await msg.react('👀');

        try {
            // RAG Limit (Ambil konteks secukupnya)
            const [m] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 20");
            const [h] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 10");

            const textM = m.map(x => `- ${x.fakta}`).join("\n");
            // Format History kita kasih tanda biar AI tau ini "Record" bukan "Dialog Aktif"
            const textH = h.reverse().map(x => `[History] ${x.nama_pengirim}: ${x.pesan}`).join("\n");

            // PROMPT ANTI GOBLOK & ANTI PREFIX
            const finalPrompt = `
            ROLE: Kamu adalah AI Assistant yang cerdas.
            
            [CONTEXT MEMORY USER]:
            ${textM}

            [CONTEXT HISTORY CHAT]:
            ${textH}

            [PERINTAH USER SAAT INI]:
            "${promptUser}"

            ATURAN JAWAB (STRICT):
            1. JAWAB LANGSUNG isinya. JANGAN pakai awalan nama seperti "Dini:", "Bot:", "AI:". HARAM.
            2. Jika User minta "Parafrase" atau "Rewrite", TULIS ULANG kalimatnya dalam bahasa yang sama (Jangan Translate kecuali diminta).
            3. Jika User minta "Translate", baru terjemahkan.
            4. Gunakan bahasa yang santai tapi sopan.
            `;

            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            const result = await model.generateContent(payload);
            let responseAi = result.response.text().trim();

            // --- FILTER SCRIPT (SAFETY NET) ---
            // Ini bakal ngehapus paksa kalau AI masih ngeyel nulis prefix
            responseAi = responseAi.replace(/^(Dini|Tami|Bot|AI|Asisten):\s*/i, ''); // Hapus Nama:
            responseAi = responseAi.replace(/^["']+|["']+$/g, ''); // Hapus tanda kutip di awal/akhir

            await client.sendMessage(chatDestination, responseAi);

        } catch (error) {
            console.error("AI Error:", error);
            await client.sendMessage(chatDestination, "🤕 Otak gw nge-lag dikit. Coba lagi.");
        }
    }
};

module.exports = { interact, observe };

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai [tanya]', desc: 'Tanya AI' },
        { command: '!ingat [fakta]', desc: 'Ajari fakta baru' }
    ]
};