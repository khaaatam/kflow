const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- FUNGSI PENCATAT RAHASIA (AUTO-LEARN) ---
const observe = async (text, db, namaPengirim) => {
    if (text.length < 10) return; 

    const promptObserver = `
    Tugas: Ekstrak FAKTA PENTING tentang user dari chat ini.
    User: ${namaPengirim}
    Chat: "${text}"
    
    Aturan:
    1. Jika ada fakta baru (hobi, rencana, dll), output: [[SAVEMEMORY: isi fakta]].
    2. Jika tidak ada, kosongkan output.
    3. HANYA output kode [[SAVEMEMORY:...]].
    `;

    try {
        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();
        if (response.includes('[[SAVEMEMORY:')) {
            const memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();
            console.log(`🧠 [SILENT-LEARN] Mencatat fakta dari ${namaPengirim}: ${memory}`);
            db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);
        }
    } catch (e) { }
};

// --- FUNGSI INTERAKSI UTAMA (JAWAB CHAT + GAMBAR) ---
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
    // Support: Teks biasa ATAU Caption Gambar
    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        let promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();
        
        // Handling Gambar
        let imagePart = null;
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.mimetype.startsWith('image/')) {
                    imagePart = {
                        inlineData: {
                            data: media.data,
                            mimeType: media.mimetype
                        }
                    };
                    if (!promptUser) promptUser = "Jelasin ini gambar apa?"; // Default kalo cuma kirim gambar + !ai
                }
            } catch (error) {
                console.error("Gagal download media:", error);
                return client.sendMessage(chatDestination, "Gagal baca gambar, Bang. Coba kirim ulang.");
            }
        }

        if (!promptUser && !imagePart) return client.sendMessage(chatDestination, "Mau diskusi apa?");

        await msg.react('👁️'); // Reaksi mata kalo lagi liat gambar/mikir

        // Tarik Context
        const getMemori = new Promise(r => db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 10", (err, res) => r(err ? [] : res)));
        const getHistory = new Promise(r => db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 30", (err, res) => r(err ? [] : res.reverse())));
        const [m, h] = await Promise.all([getMemori, getHistory]);

        const textM = m.map(x => `- ${x.fakta}`).join("\n");
        const textH = h.map(x => `${x.nama_pengirim}: ${x.pesan}`).join("\n");

        const finalPrompt = `
        Role: Partner Diskusi Cerdas (K-Bot).
        User: ${namaPengirim}
        
        [MEMORI USER]
        ${textM}

        [HISTORY CHAT]
        ${textH}
        
        [PERTANYAAN BARU]
        ${namaPengirim}: ${promptUser}
        ${imagePart ? "[USER MENGIRIM GAMBAR. ANALISA GAMBARNYA SESUAI PERTANYAAN]" : ""}
        
        Instruksi:
        1. Jawab solutif, cerdas, gaya bahasa 'gw/lu' santai.
        2. Kalau ada gambar, komentari detail visualnya (warnanya, bentuknya, suasananya).
        3. Jangan pake markdown bintang (*).
        `;

        try {
            // Kalau ada gambar, formatnya jadi array [text, image]
            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            
            const result = await model.generateContent(payload);
            const response = result.response;
            let cleanResponse = response.text().replace(/\*/g, '').trim();

            await client.sendMessage(chatDestination, cleanResponse);
        } catch (error) {
            console.error("ai error:", error);
            await client.sendMessage(chatDestination, "Waduh, mata gw burem (Error API).");
        }
    }
};

module.exports = { interact, observe };