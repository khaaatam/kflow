const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- FUNGSI PENCATAT RAHASIA (AUTO-LEARN) ---
// Fungsi ini cuma "Membaca" dan "Menyimpan", GAK BAKAL BALES CHAT.
const observe = async (text, db, namaPengirim) => {
    // Hemat kuota: Jangan analisa chat pendek/gak penting (misal "ok", "y", "wkwk")
    if (text.length < 10) return;

    const promptObserver = `
    Tugas: Ekstrak FAKTA PENTING tentang user dari chat ini.
    User: ${namaPengirim}
    Chat: "${text}"

    Aturan:
    1. Jika chat berisi fakta baru (hobi, rencana, tanggal penting, kesukaan), tulis output dengan format: [[SAVEMEMORY: isi fakta ringkas]].
    2. Jika chat cuma basa-basi/sampah, JANGAN output apa-apa (kosongkan).
    3. Output HANYA kode [[SAVEMEMORY:...]] jika ada. Jangan ada teks lain.
    `;

    try {
        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        if (response.includes('[[SAVEMEMORY:')) {
            const memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();
            console.log(`🧠 [SILENT-LEARN] Mencatat fakta dari ${namaPengirim}: ${memory}`);

            // Simpan ke database tanpa ngasih tau user
            db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);
        }
    } catch (e) {
        // Silent error (biar gak ngebisingin log)
    }
};

// --- FUNGSI INTERAKSI UTAMA (JAWAB CHAT) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. CEK COMMAND MANUAL (!INGAT)
    if (text.startsWith('!ingat')) {
        const faktaBaru = msg.body.replace(/!ingat/i, '').trim();
        if (!faktaBaru) return client.sendMessage(chatDestination, "apa yang harus gw inget?");
        db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], (err) => {
            if (!err) client.sendMessage(chatDestination, "Oke, tersimpan manual.");
        });
        return;
    }

    // 2. CEK COMMAND TANYA JAWAB (!AI)
    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        const promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();
        if (!promptUser) return client.sendMessage(chatDestination, "Mau diskusi apa?");

        await msg.react('🤖');

        // Tarik Context
        const getMemori = new Promise(r => db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 10", (err, res) => r(err ? [] : res)));
        const getHistory = new Promise(r => db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 50", (err, res) => r(err ? [] : res.reverse())));
        const [m, h] = await Promise.all([getMemori, getHistory]);

        const textM = m.map(x => `- ${x.fakta}`).join("\n");
        const textH = h.map(x => `${x.nama_pengirim}: ${x.pesan}`).join("\n");

        // Prompt Partner Diskusi (Sama kyk sebelumnya)
        const finalPrompt = `
        Role: Partner Diskusi Cerdas (K-Bot).
        User: ${namaPengirim}
        [MEMORI] ${textM}
        [HISTORY] ${textH}
        [PERTANYAAN] ${promptUser}
        
        Instruksi: Jawab solutif, cerdas, gaya bahasa 'gw/lu' santai. Jangan pake markdown bintang (*).
        `;

        try {
            const res = await model.generateContent(finalPrompt);
            let reply = res.response.text().replace(/\*/g, '').trim();
            await client.sendMessage(chatDestination, reply);
        } catch (e) {
            client.sendMessage(chatDestination, "Otak gw error bentar.");
        }
    }
};

module.exports = { interact, observe };