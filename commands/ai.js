const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- OBSERVER (DETEKTIF MEMORI) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;

    // 1. FILTER DASAR
    if (text.length < 5 || text.split(' ').length < 2) return;
    if (text.startsWith('!') || text.startsWith('/')) return; // Skip Command

    // 2. FILTER SAMPAH TEKNIS (PENTING! 🛡️)
    // Kalau chat mengandung kata-kata ini, JANGAN dicatat sebagai memori.
    const technicalTerms = ['bot', 'fitur', 'command', 'sistem', 'ai', 'gpt', 'analisa', 'respon', 'trigger', 'menu'];
    if (technicalTerms.some(term => text.toLowerCase().includes(term))) return;

    // 3. TRIGGER WORDS (FILTER EMOSI)
    // Cuma jalan kalau ada kata kunci personal
    const triggerWords = ['aku', 'gw', 'saya', 'suka', 'benci', 'pengen', 'mau', 'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur', 'jangan', 'kecewa', 'senang', 'marah', 'sedih', 'lapar', 'makan', 'minum', 'sakit', 'capek', 'lelah'];

    if (!triggerWords.some(word => text.toLowerCase().includes(word))) return;

    try {
        // Ambil Konteks Chat (Tanpa Command)
        const [rowsChat] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 10");
        const contextHistory = rowsChat.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        // 👇 PROMPT YANG LEBIH GALAK 👇
        const promptObserver = `
        Tugas: Kamu adalah pencatat memori. Ekstrak FAKTA PERSONAL USER (${namaPengirim}).
        
        [KONTEKS CHAT]:
        ${contextHistory}
        
        [INPUT USER]:
        "${text}"
        
        ATURAN WAJIB (DO & DON'T):
        ✅ CATAT: Preferensi makanan, hobi, kondisi fisik (sakit/sehat), perasaan, hubungan, cita-cita.
        ❌ JANGAN CATAT: Interaksi dengan bot, penggunaan fitur/command, atau hal teknis (Contoh: "User menggunakan fitur saran" -> HIRAIKAN!).
        ❌ JANGAN CATAT: Pendapat sesaat yang tidak penting.
        
        Output Format: [[SAVEMEMORY: Isi Fakta Singkat Padat]]
        Jika tidak ada fakta personal yang valid, Output: KOSONG
        `;

        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();
        const match = response.match(/\[\[SAVEMEMORY:\s*(.*?)\]\]/);

        if (match && match[1]) {
            let rawMemory = match[1].trim();

            // Double Filter: Kalau hasil memory-nya masih bau-bau teknis, buang.
            if (technicalTerms.some(term => rawMemory.toLowerCase().includes(term))) return;

            const finalMemory = `[${namaPengirim}] ${rawMemory}`;

            // Cek Duplikat
            const [duplikat] = await db.query("SELECT id FROM memori WHERE fakta LIKE ?", [`%${rawMemory}%`]);

            if (duplikat.length === 0) {
                await db.query("INSERT INTO memori (fakta) VALUES (?)", [finalMemory]);
                console.log(`🧠 [MEMORI] ${namaPengirim} -> ${rawMemory}`);

                if (config.system?.logNumber) {
                    try {
                        const laporan = `📝 *MEMORI BARU*\n👤 ${namaPengirim}: "${rawMemory}"`;
                        await client.sendMessage(config.system.logNumber, laporan);
                    } catch (e) { }
                }
            }
        }
    } catch (e) {
        // Silent error biar gak spam console
    }
};

// --- INTERACT (CHAT AI BIASA) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    if (text.startsWith('!setpersona ')) {
        const newPersona = msg.body.replace(/!setpersona/i, '').trim();
        await db.query("UPDATE system_instruction SET is_active = 0");
        await db.query("INSERT INTO system_instruction (instruction) VALUES (?)", [newPersona]);
        return client.sendMessage(chatDestination, `✅ Persona berubah: "${newPersona}"`);
    }

    if (text.startsWith('!ingat ')) {
        const rawFakta = msg.body.replace(/!ingat/i, '').trim();
        const finalFakta = `[${namaPengirim}] ${rawFakta}`;
        await db.query("INSERT INTO memori (fakta) VALUES (?)", [finalFakta]);
        return client.sendMessage(chatDestination, `✅ Dicatat: "${finalFakta}"`);
    }

    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        let promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();
        let imagePart = null;

        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.mimetype.startsWith('image/')) {
                    imagePart = { inlineData: { data: media.data, mimeType: media.mimetype } };
                    if (!promptUser) promptUser = "Jelasin gambar";
                }
            } catch (e) { return client.sendMessage(chatDestination, "❌ Error media."); }
        }
        if (!promptUser && !imagePart) return client.sendMessage(chatDestination, "Ya?");

        await msg.react('👀');

        try {
            const [rowsInst] = await db.query("SELECT instruction FROM system_instruction WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
            const dynamicPersona = rowsInst.length > 0 ? rowsInst[0].instruction : "Kamu asisten.";

            const [m] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 20");
            const [h] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 15");

            const textM = m.map(x => `- ${x.fakta}`).join("\n");
            const textH = h.reverse().map(x => `[${x.nama_pengirim}]: ${x.pesan}`).join("\n");

            const finalPrompt = `
            [SYSTEM]: ${dynamicPersona}
            [MEMORY]: ${textM}
            [HISTORY]: ${textH}
            [USER]: "${promptUser}"
            [INSTRUCTION]: No prefix (Bot:), No translate. Jawab natural.
            `;

            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            const result = await model.generateContent(payload);
            let responseAi = result.response.text().trim();
            responseAi = responseAi.replace(/^(Dini|Tami|Bot|AI):\s*/i, '').replace(/^["']+|["']+$/g, '');

            await client.sendMessage(chatDestination, responseAi);

        } catch (error) {
            console.error(error);
            await client.sendMessage(chatDestination, "Eror bang.");
        }
    }
};

module.exports = { interact, observe };

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai', desc: 'Chat AI' },
        { command: '!ingat', desc: 'Simpan fakta' },
        { command: '!setpersona', desc: 'Ubah sifat' }
    ]
};