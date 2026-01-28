const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- OBSERVER (Auto Learn + Lapor WA) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;
    if (text.length < 5 || text.split(' ').length < 2) return;

    // Trigger words tetap sama
    const triggerWords = ['aku', 'gw', 'saya', 'suka', 'benci', 'pengen', 'mau', 'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur', 'jangan', 'kecewa', 'senang', 'marah', 'sedih'];
    if (!triggerWords.some(word => text.toLowerCase().includes(word))) return;

    try {
        const [rowsChat] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 10");
        const contextHistory = rowsChat.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        const promptObserver = `
        Tugas: Ekstrak FAKTA BARU user ${namaPengirim}.
        Chat: ${contextHistory}
        User: "${text}"
        Output: [[SAVEMEMORY: Fakta]] atau KOSONG
        `;

        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();
        const match = response.match(/\[\[SAVEMEMORY:\s*(.*?)\]\]/);

        if (match && match[1]) {
            let memory = match[1].trim();
            const [duplikat] = await db.query("SELECT id FROM memori WHERE fakta LIKE ?", [`%${memory}%`]);

            if (duplikat.length === 0) {
                // 1. Simpan ke Database
                await db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

                // 👇 UPDATE 1: Console lebih jelas
                console.log(`🧠 [MEMORI] ${namaPengirim}: ${memory}`);

                // 👇 UPDATE 2: Laporan WA lebih detail (Ada Nama & Waktu)
                if (config.system?.logNumber) {
                    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    try {
                        const laporan = `📝 *MEMORI BARU* [${now}]\n` +
                            `👤 *Subjek:* ${namaPengirim}\n` +
                            `💡 *Fakta:* "${memory}"`;

                        await client.sendMessage(config.system.logNumber, laporan);
                    } catch (e) {
                        console.error("Gagal kirim log memori:", e.message);
                    }
                }
            }
        }
    } catch (e) { }
};

// --- INTERACT (Dynamic Persona) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. SET PERSONA (Ganti Sifat)
    if (text.startsWith('!setpersona ')) {
        const newPersona = msg.body.replace(/!setpersona/i, '').trim();
        await db.query("UPDATE system_instruction SET is_active = 0");
        await db.query("INSERT INTO system_instruction (instruction) VALUES (?)", [newPersona]);
        return client.sendMessage(chatDestination, `✅ Siap! Kepribadian gw udah berubah jadi:\n"${newPersona}"`);
    }

    // 2. INGAT MANUAL
    if (text.startsWith('!ingat ')) {
        const fakta = msg.body.replace(/!ingat/i, '').trim();
        await db.query("INSERT INTO memori (fakta) VALUES (?)", [fakta]);
        return client.sendMessage(chatDestination, `✅ Oke, gw catet di memori: "${fakta}"`);
    }

    // 3. AI CHAT
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
            // Ambil Persona & Data
            const [rowsInst] = await db.query("SELECT instruction FROM system_instruction WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
            const dynamicPersona = rowsInst.length > 0 ? rowsInst[0].instruction : "Kamu adalah AI asisten.";

            const [m] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 20");
            const [h] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 15");

            const textM = m.map(x => `- ${x.fakta}`).join("\n");
            const textH = h.reverse().map(x => {
                let cleanMsg = x.pesan.replace(/^(Dini|Tami|Bot|AI|Asisten):\s*/i, '');
                cleanMsg = cleanMsg.replace(/^["']+|["']+$/g, '');
                return `[${x.nama_pengirim}]: ${cleanMsg}`;
            }).join("\n");

            const finalPrompt = `
            [SYSTEM PERSONA]: ${dynamicPersona}
            [MEMORY]: ${textM}
            [HISTORY]: ${textH}
            [USER]: "${promptUser}"
            [RULES]: No prefix (Bot:/Dini:), No translate (unless asked).
            `;

            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            const result = await model.generateContent(payload);
            let responseAi = result.response.text().trim();

            responseAi = responseAi.replace(/^(Dini|Tami|Bot|AI):\s*/i, '').replace(/^["']+|["']+$/g, '');
            await client.sendMessage(chatDestination, responseAi);

        } catch (error) {
            console.error("AI Error:", error);
            await client.sendMessage(chatDestination, "🤕 Error bang, coba lagi.");
        }
    }
};

module.exports = { interact, observe };

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai [chat]', desc: 'Chat AI' },
        { command: '!ingat [fakta]', desc: 'Simpan fakta' },
        { command: '!setpersona [sifat]', desc: 'Ubah sifat bot' }
    ]
};