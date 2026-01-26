const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- OBSERVER (Auto Learn) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;
    if (text.length < 5) return;

    const triggerWords = ['aku', 'gw', 'saya', 'suka', 'benci', 'pengen', 'mau', 'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur', 'jangan', 'kecewa', 'senang', 'marah', 'sedih'];
    if (!triggerWords.some(word => text.toLowerCase().includes(word))) return;

    try {
        // 1. Context Chat (Async)
        const [rowsChat] = await db.query("SELECT nama_pengirim, pesan, is_forwarded FROM full_chat_logs ORDER BY id DESC LIMIT 15");
        const contextHistory = rowsChat.reverse().map(r => `${r.nama_pengirim} ${r.is_forwarded ? '[FWD]' : ''}: "${r.pesan}"`).join("\n");

        // 2. Existing Facts (Async)
        const [rowsMem] = await db.query("SELECT fakta FROM memori");
        const existingFacts = rowsMem.map(r => `- ${r.fakta}`).join("\n");

        // 3. Prompt
        const promptObserver = `
        Role: Hakim Data.
        Tugas: Analisa pesan "${text}" dari ${namaPengirim}.
        Konteks Chat: \n${contextHistory}\n
        Fakta Lama: \n${existingFacts}\n
        Output: [[SAVEMEMORY: Fakta]] jika valid & baru. Kosong jika tidak.
        `;

        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        if (response.includes('[[SAVEMEMORY:')) {
            let memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();
            if (memory.toLowerCase().includes('sedang') || memory.toLowerCase().includes('lagi ')) return;

            // Cek Duplikat
            const [duplikat] = await db.query("SELECT id FROM memori WHERE fakta = ?", [memory]);
            if (duplikat.length === 0) {
                console.log(`🧠 [MEMORI BARU] ${memory}`);
                await db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);
                if (config.system?.logNumber) await client.sendMessage(config.system.logNumber, `📝 *MEMORI BARU:*\n"${memory}"`);
            }
        }
    } catch (e) { } // Silent fail
};

// --- INTERACT (!ai) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. !ingat
    if (text.startsWith('!ingat ')) {
        const fakta = msg.body.replace(/!ingat/i, '').trim();
        await db.query("INSERT INTO memori (fakta) VALUES (?)", [fakta]);
        return client.sendMessage(chatDestination, `✅ Oke, gw catet: "${fakta}"`);
    }

    // 2. !ai / !analisa
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
            // RAG (Async)
            const [m] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 20");
            const [h] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 20");

            const textM = m.map(x => `- ${x.fakta}`).join("\n");
            const textH = h.reverse().map(x => `${x.nama_pengirim}: ${x.pesan}`).join("\n");

            const finalPrompt = `
            Identity: Bot-Duit, asisten ${namaPengirim}.
            Fakta: \n${textM}\n
            History: \n${textH}\n
            User: "${promptUser}"
            Jawab santai, akrab.
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

// --- EXPORTS CORRECTED ---
module.exports = { interact, observe };

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai [tanya]', desc: 'Tanya AI' },
        { command: '!ingat [fakta]', desc: 'Ajari fakta baru' }
    ]
};