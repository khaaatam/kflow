const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- OBSERVER (Auto Learn) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;
    if (text.length < 5 || text.split(' ').length < 2) return;

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
            if (duplikat.length === 0) {
                // 1. Simpan ke Database
                await db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);
                // 2. Log ke WA
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
            // Format History kita perjelas biar AI gak bingung
            const textH = h.reverse().map(x => `[${x.nama_pengirim}]: ${x.pesan}`).join("\n");

            // PROMPT BARU YANG LEBIH TEGAS
            const finalPrompt = `
            ROLE: Kamu adalah AI Asisten Pintar.
            TARGET USER: ${namaPengirim}

            [MEMORY / FAKTA USER]:
            ${textM}

            [CHAT HISTORY TERAKHIR]:
            ${textH}

            [PERMINTAAN USER SAAT INI]:
            "${promptUser}"

            INSTRUKSI PENTING:
            1. Jawab permintaan user dengan TEPAT.
            2. JANGAN menerjemahkan jika diminta paraphrase/tulis ulang (kecuali diminta translate).
            3. JANGAN mengawali jawaban dengan nama user (contoh: "Dini: ...") atau "Bot: ...".
            4. Jika diminta Bahasa Inggris, jawab Bahasa Inggris. Jika Indonesia, jawab Indonesia.
            5. Langsung berikan jawaban intinya.
            `;

            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            const result = await model.generateContent(payload);
            let responseAi = result.response.text().trim();

            // CLEANING OUTPUT (Anti Halu)
            // Kalau dia masih bandel nulis "Dini:" atau "Bot:", kita hapus paksa.
            responseAi = responseAi.replace(/^(Dini|Tami|Bot|AI):\s*/i, '');
            responseAi = responseAi.replace(/^"\s*/, '').replace(/\s*"$/, ''); // Hapus kutip di awal/akhir yg gak perlu

            await client.sendMessage(chatDestination, responseAi);

        } catch (error) {
            console.error("AI Error:", error);
            await client.sendMessage(chatDestination, "🤕 Otak gw nge-lag (API Error). Coba lagi bentar.");
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