const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
// Pastikan model di config pake 'gemini-1.5-flash' biar support gambar & hemat
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- FUNGSI PENCATAT RAHASIA (SMART OBSERVER V2) ---
const observe = async (client, text, db, namaPengirim) => {
    // 1. Filter Awal: Chat pendek skip aja biar hemat
    if (text.length < 10) return;

    // 2. Ambil ingatan lama (biar gak duplikat)
    const existingFacts = await new Promise((resolve) => {
        db.query("SELECT fakta FROM memori", (err, rows) => {
            if (err || !rows || rows.length === 0) resolve("Belum ada ingatan.");
            else resolve(rows.map(row => `- ${row.fakta}`).join("\n"));
        });
    });

    // 3. PROMPT "DETECTIVE LOGIC" (FIX SUBJEK & OBJEK)
    const promptObserver = `
    Role: Analis Data Intelijen yang CERDAS & KRITIS.
    Tugas: Ekstrak FAKTA VALID dari chat berikut untuk database memori.

    PENGIRIM PESAN: ${namaPengirim}
    ISI PESAN: "${text}"

    === DATABASE INGATAN LAMA (CEK DUPLIKASI) ===
    ${existingFacts}
    ==============================================

    === ATURAN TATABAHASA & LOGIKA SUBJEK (WAJIB PATUH) ===
    1. "Aku/Gw/Saya" = PASTI merujuk pada PENGIRIM (${namaPengirim}).
    2. "Dia/Mereka" atau NAMA ORANG (misal: Dini, Koko, Budi) = PASTI Pihak Ketiga. Catat fakta tentang mereka.
    
    ⚠️ 3. KASUS KHUSUS KATA "KAMU/LU" (HATI-HATI!):
       - Analisa dulu: Apakah pesan ini ditujukan ke BOT atau ke ORANG LAIN?
       - JIKA KE BOT (misal: "Lu kok lemot", "Kamu pinter"): JANGAN DICATAT.
       - JIKA KE ORANG LAIN (misal dalam percakapan: "Kamu cantik", "Kamu mau makan apa?"): Ganti kata "Kamu" dengan nama lawan bicara (jika tahu) atau "Lawan Bicara".
       - Contoh: Tami bilang "Kamu cantik" (konteks ngomong ke Dini) -> Simpan: "Tami memuji Dini cantik".

    INSTRUKSI OUTPUT:
    - Analisa dulu: SIAPA subjeknya? APA predikatnya?
    - Cek Database: Apakah fakta ini sudah ada? (Walau beda kalimat). Jika ada, ABAIKAN.
    - Cek Logika: Apakah masuk akal? (Misal: Cowoknya Dini ngajak User nikah -> Aneh. Pasti salah subjek).
    - JIKA VALID & BARU: Outputkan format [[SAVEMEMORY: Subjek + Predikat + Objek]].
    - JIKA SAMPAH/DUPLIKAT/BINGUNG: Jangan output apa-apa.

    CONTOH KOREKSI:
    Chat (Dini): "Koko ngajak nikah"
    -> Analisa: Pengirim Dini. Dia bilang Koko ajak nikah. Berarti Koko ajak Dini (bukan Tami).
    -> Output: [[SAVEMEMORY: Koko mengajak Dini menikah]]

    Chat (Tami): "Mulai sekarang panggil gw Raja Iblis"
    -> Analisa: User minta nickname baru.
    -> Output: [[SAVEMEMORY: User ingin dipanggil Raja Iblis]]
    `;

    try {
        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        if (response.includes('[[SAVEMEMORY:')) {
            let memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();

            // Filter panjang (max 20 kata biar gak halu)
            if (memory.split(' ').length > 20) return;

            // Kalau faktanya malah nyatet nama bot sendiri, buang
            if (memory.toLowerCase().includes('bot') || memory.toLowerCase().includes('kamu')) return;

            console.log(`🧠 [SMART-LEARN V2] Fakta Valid: ${memory}`);
            db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

            // Lapor ke Log Number (Jika ada)
            if (config.system && config.system.logNumber) {
                try {
                    await client.sendMessage(config.system.logNumber, `🧠 *SILENT LEARN*\n\n👤 Sumber: ${namaPengirim}\n📝 Fakta: "${memory}"`);
                } catch (err) { }
            }
        }
    } catch (e) { }
};

// --- FUNGSI INTERAKSI UTAMA (JAWAB CHAT + GAMBAR + MEMORI + DYNAMIC PERSONA) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. HANDLE MANUAL INPUT (!INGAT)
    if (text.startsWith('!ingat ')) {
        const faktaBaru = msg.body.replace(/!ingat/i, '').trim();
        if (!faktaBaru) return client.sendMessage(chatDestination, "Apa yang harus gw inget Bang?");

        db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], (err) => {
            if (!err) client.sendMessage(chatDestination, `✅ Oke Bang, gw catet: "${faktaBaru}"`);
        });
        return;
    }

    // 2. HANDLE TANYA JAWAB (!AI / !ANALISA / CHAT BIASA)
    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        let promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();

        // A. Handling Gambar (Vision)
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
                    // Kalau cuma kirim gambar tanpa caption
                    if (!promptUser) promptUser = "Jelasin secara detail ini gambar apa?";
                }
            } catch (error) {
                console.error("Gagal download media:", error);
                return client.sendMessage(chatDestination, "❌ Gagal baca gambar. Coba kirim ulang Bang.");
            }
        }

        if (!promptUser && !imagePart) return client.sendMessage(chatDestination, "Mau diskusi apa Bang?");

        // Kasih reaksi biar keliatan mikir
        await msg.react('👀');

        // B. Tarik Context (RAG - Retrieval Augmented Generation)
        const getMemori = new Promise(r => db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 15", (err, res) => r(err ? [] : res)));
        const getHistory = new Promise(r => db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 30", (err, res) => r(err ? [] : res.reverse())));
        const [m, h] = await Promise.all([getMemori, getHistory]);

        const textM = m.map(x => `- ${x.fakta}`).join("\n");
        const textH = h.map(x => `${x.nama_pengirim}: ${x.pesan}`).join("\n");

        // C. THE ULTIMATE PROMPT (DYNAMIC PERSONA)
        const finalPrompt = `
        === SYSTEM INSTRUCTION (IDENTITAS DASAR) ===
        Kamu adalah "Bot-Duit", asisten pribadi cerdas.
        
        ATURAN DEFAULT (BISA DI-OVERRIDE OLEH MEMORI):
        1. Secara default, panggil user "Bang Tami" atau "Bang".
        2. Gunakan bahasa Indonesia gaul, santai, akrab (Lo/Gw).
        3. Kamu jago coding, Linux, dan DevOps.
        
        ⚠️ ATURAN MUTLAK (PRIORITAS TERTINGGI) ⚠️:
        Cek bagian [MEMORI USER] di bawah. Jika di situ ada instruksi spesifik tentang:
        - Panggilan/Nickname khusus (misal: "Panggil gw Raja Iblis").
        - Perubahan sifat (misal: "Jadilah galak").
        - Gaya bicara baru.
        MAKA KAMU WAJIB MENGIKUTI INSTRUKSI DI MEMORI TERSEBUT dan abaikan aturan default di atas.

        [MEMORI JANGKA PANJANG (FAKTA & INSTRUKSI USER)]
        ${textM}
        (Gunakan fakta ini sebagai hukum tertinggimu).

        [HISTORY CHAT TERAKHIR]
        ${textH}

        [PERMINTAAN USER SAAT INI]
        User: ${promptUser}
        ${imagePart ? "[NOTE: USER MENGIRIM GAMBAR. BACA VISUALNYA!]" : ""}
        `;

        try {
            // D. Eksekusi Gemini
            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            const result = await model.generateContent(payload);
            const response = result.response.text().trim();

            await client.sendMessage(chatDestination, response);
        } catch (error) {
            console.error("AI Error:", error);
            await client.sendMessage(chatDestination, "🤕 Waduh, otak gw nge-bug bentar Bang (API Error). Coba tanya lagi.");
        }
    }
};

module.exports = { interact, observe };

// TAMBAHAN METADATA MENU
module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai [tanya]', desc: 'Tanya Gemini AI (Bisa kirim gambar)' },
        { command: '!ingat [fakta]', desc: 'Ajari AI fakta baru' },
        { command: '!analisa', desc: 'Analisa gambar/chat' }
    ]
};