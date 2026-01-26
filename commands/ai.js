const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- OBSERVER (Auto Learn) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;
    // Filter ketat: Pesan pendek banget gak usah dianalisa
    if (text.length < 5 || text.split(' ').length < 2) return;

    // Trigger words tetap sama
    const triggerWords = ['aku', 'gw', 'saya', 'suka', 'benci', 'pengen', 'mau', 'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur', 'jangan', 'kecewa', 'senang', 'marah', 'sedih'];
    if (!triggerWords.some(word => text.toLowerCase().includes(word))) return;

    try {
        // 1. Context Chat (Batasi 10 aja biar hemat token)
        const [rowsChat] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 10");
        const contextHistory = rowsChat.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        // 2. Existing Facts (PENTING: KASIH LIMIT & ORDER TERBARU)
        // Biar memori lama gak menuh-menuhin prompt
        const [rowsMem] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 30");
        const existingFacts = rowsMem.map(r => `- ${r.fakta}`).join("\n");

        // 3. Prompt (Lebih Spesifik)
        const promptObserver = `
        Tugas: Ekstrak FAKTA BARU & PERMANEN tentang ${namaPengirim} dari chat terakhir.
        
        [DATABASE FAKTA LAMA]:
        ${existingFacts}

        [CHAT TERAKHIR]:
        ${contextHistory}
        User: "${text}"

        ATURAN:
        - Hanya catat info PENTING: Nama, Tanggal Lahir, Hobi, Tempat Tinggal, Status Hubungan, Kebencian/Kesukaan Permanen.
        - JANGAN catat: Perasaan sesaat (lagi sedih, lagi makan), opini sekilas, atau pertanyaan.
        - Jika info SUDAH ADA di Database Fakta Lama, JANGAN dicatat lagi.
        
        Output format: [[SAVEMEMORY: Isi Fakta]]
        Jika tidak ada fakta penting baru, output: KOSONG
        `;

        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        // 4. Regex Parsing yang Lebih Aman
        const match = response.match(/\[\[SAVEMEMORY:\s*(.*?)\]\]/);

        if (match && match[1]) {
            let memory = match[1].trim();

            // Filter sampah manual
            const blacklist = ['lagi', 'sedang', 'akan', 'barusan', 'tadi', 'mungkin', '?'];
            if (blacklist.some(b => memory.toLowerCase().includes(b))) return;

            // Cek Duplikat di DB (Double Check)
            const [duplikat] = await db.query("SELECT id FROM memori WHERE fakta LIKE ?", [`%${memory}%`]);
            if (duplikat.length === 0) {
                // 1. Simpan ke Database (PENTING!)
                await db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

                // 2. Kirim Log ke WA Owner
                if (config.system?.logNumber) {
                    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    await client.sendMessage(config.system.logNumber, `📝 *MEMORI BARU* [${now}]\n"${memory}"`);
                }
            }
        }
    } catch (e) {
        // Silent fail biar gak spam console
    }
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
            // RAG Limit 20
            const [m] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 20");
            const [h] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 20");

            const textM = m.map(x => `- ${x.fakta}`).join("\n");
            const textH = h.reverse().map(x => `${x.nama_pengirim}: ${x.pesan}`).join("\n");

            const finalPrompt = `
            Identity: Bot Asisten Personal ${namaPengirim}.
            Fakta User: \n${textM}\n
            History Chat: \n${textH}\n
            Pertanyaan User: "${promptUser}"
            Jawab singkat, padat, dan membantu.
            `;

            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            const result = await model.generateContent(payload);
            await client.sendMessage(chatDestination, result.response.text().trim());

        } catch (error) {
            console.error("AI Error:", error);
            await client.sendMessage(chatDestination, "🤕 Otak gw nge-lag.");
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