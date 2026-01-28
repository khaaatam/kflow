const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- OBSERVER (Pencatat Memori Pintar) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;
    // Filter pesan pendek gak penting
    if (text.length < 5 || text.split(' ').length < 2) return;

    // Trigger words (Biar gak boros kuota AI)
    const triggerWords = ['aku', 'gw', 'saya', 'suka', 'benci', 'pengen', 'mau', 'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur', 'jangan', 'kecewa', 'senang', 'marah', 'sedih'];
    if (!triggerWords.some(word => text.toLowerCase().includes(word))) return;

    try {
        // Ambil konteks chat terakhir buat bahan analisa
        const [rowsChat] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 10");
        const contextHistory = rowsChat.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        const promptObserver = `
        Tugas: Ekstrak FAKTA BARU tentang user ${namaPengirim} dari chat ini.
        Context: ${contextHistory}
        User Input: "${text}"
        
        RULES:
        1. Ambil inti faktanya saja (Contoh: "Suka nasi goreng", "Ultah tanggal 5").
        2. Output format: [[SAVEMEMORY: Isi Fakta]]
        3. Jika tidak ada fakta penting, Output: KOSONG
        `;

        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();
        const match = response.match(/\[\[SAVEMEMORY:\s*(.*?)\]\]/);

        if (match && match[1]) {
            let rawMemory = match[1].trim();

            // 👇 UPGRADE PENTING: TEMPEL NAMA DI DEPAN MEMORI 👇
            // Jadi di DB kesimpen: "[Tami] Suka nasi goreng kambing"
            const finalMemory = `[${namaPengirim}] ${rawMemory}`;

            // Cek Duplikat biar gak nyampah
            const [duplikat] = await db.query("SELECT id FROM memori WHERE fakta LIKE ?", [`%${rawMemory}%`]);

            if (duplikat.length === 0) {
                // Simpan ke DB (Sekarang udah ada namanya)
                await db.query("INSERT INTO memori (fakta) VALUES (?)", [finalMemory]);

                // Log Console (Lebih enak dibaca)
                console.log(`🧠 [MEMORI] ${namaPengirim} -> ${rawMemory}`);

                // Lapor ke WA Owner (Biar lu tau dia nyatet apa)
                if (config.system?.logNumber) {
                    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
                    try {
                        const laporan = `📝 *MEMORI BARU* [${now}]\n` +
                            `👤 *User:* ${namaPengirim}\n` +
                            `💡 *Fakta:* "${rawMemory}"`;
                        await client.sendMessage(config.system.logNumber, laporan);
                    } catch (e) { }
                }
            }
        }
    } catch (e) {
        // Silent error biar gak ganggu
    }
};

// --- INTERACT (Otak Utama) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. GANTI KEPRIBADIAN (!setpersona)
    if (text.startsWith('!setpersona ')) {
        const newPersona = msg.body.replace(/!setpersona/i, '').trim();
        await db.query("UPDATE system_instruction SET is_active = 0");
        await db.query("INSERT INTO system_instruction (instruction) VALUES (?)", [newPersona]);
        return client.sendMessage(chatDestination, `✅ Siap! Kepribadian gw berubah jadi:\n"${newPersona}"`);
    }

    // 2. INGAT MANUAL (!ingat)
    if (text.startsWith('!ingat ')) {
        const rawFakta = msg.body.replace(/!ingat/i, '').trim();
        // Simpan manual juga pake nama
        const finalFakta = `[${namaPengirim}] ${rawFakta}`;
        await db.query("INSERT INTO memori (fakta) VALUES (?)", [finalFakta]);
        return client.sendMessage(chatDestination, `✅ Oke, gw catet: "${finalFakta}"`);
    }

    // 3. CHAT AI BIASA (!ai)
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
            // A. Ambil Persona Aktif
            const [rowsInst] = await db.query("SELECT instruction FROM system_instruction WHERE is_active = 1 ORDER BY id DESC LIMIT 1");
            const dynamicPersona = rowsInst.length > 0 ? rowsInst[0].instruction : "Kamu adalah AI asisten.";

            // B. Ambil Memori (Sekarang udah ada label [Nama]-nya, jadi AI gak bingung)
            const [m] = await db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 20");
            const [h] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 15");

            const textM = m.map(x => `- ${x.fakta}`).join("\n");
            const textH = h.reverse().map(x => {
                // Sanitasi: Hapus prefix buatan user biar AI gak niru
                let cleanMsg = x.pesan.replace(/^(Dini|Tami|Bot|AI|Asisten):\s*/i, '');
                return `[${x.nama_pengirim}]: ${cleanMsg}`;
            }).join("\n");

            const finalPrompt = `
            [SYSTEM PERSONA]: ${dynamicPersona}
            
            [INGATAN JANGKA PANJANG]:
            ${textM}

            [CHAT TERAKHIR]:
            ${textH}

            [USER INPUT]:
            "${promptUser}"

            [RULES]:
            1. Jangan pakai awalan nama (Bot: / Dini:).
            2. Jawab sesuai Persona.
            3. Gunakan data Ingatan jika relevan.
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