const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- FUNGSI PENCATAT RAHASIA (AUTO-LEARN) ---
const observe = async (client, text, db, namaPengirim) => {
    // 1. Filter Awal: Chat pendek skip aja biar hemat
    if (text.length < 10) return;

    // --- [LOGIC BARU] AMBIL DATA LAMA DULU ---
    // Kita ambil daftar fakta yang udah ada di otak bot biar dia bisa bandingin.
    const existingFacts = await new Promise((resolve) => {
        db.query("SELECT fakta FROM memori", (err, rows) => {
            if (err || !rows || rows.length === 0) resolve("Belum ada ingatan.");
            else resolve(rows.map(row => `- ${row.fakta}`).join("\n"));
        });
    });
    // ------------------------------------------

    // 2. Prompt "Few-Shot" (Dengan Konteks Memori Lama)
    const promptObserver = `
    Role: Database Admin yang SANGAT SELEKTIF.
    Tugas: Analisa chat dari User (${namaPengirim}). Putuskan apakah ada FAKTA PERMANEN BARU yang perlu disimpan?

    === DATABASE INGATAN SAAT INI (CEK DULU) ===
    ${existingFacts}
    ============================================

    ATURAN ANTI-DUPLIKAT (PENTING):
    - Cek daftar ingatan di atas.
    - Jika info di chat user SUDAH ADA di daftar (walaupun beda susunan kalimat), JANGAN simpan. Output kosong saja.
    - Contoh: Jika DB ada "Tami hobi mancing", dan user chat "Gw suka mancing", itu DUPLIKAT -> Ignore.

    Kategori Sampah (JANGAN DISIMPAN):
    - Emosi Sesaat: "Gw lagi kesel", "Gw laper", "Ngantuk", "Capek".
    - Rencana Sementara: "Besok mau ke mall", "Pengen beli bakso".
    - Pendapat Sesaat: "Filmnya bagus", "Cuacanya panas".
    - Basa-basi: "Halo", "Apa kabar", "Wkwk".

    Kategori Emas (WAJIB SIMPAN):
    - Identitas: Nama, Pekerjaan, Alamat, Umur.
    - Preferensi Permanen: "Gw alergi udang", "Gw gasuka durian", "Hobi gw mancing".
    - Aset: "Motor gw Vario", "Laptop gw Asus".
    - Relasi: "Pacar gw namanya Dini", "Bapak gw sakit".

    CONTOH ANALISA (Pelajari Polanya):
    User: "Duh gw lagi kesel banget sama bos." -> HASIL: [KOSONG] (Karena emosi sesaat)
    User: "Besok ingetin gw beli telor ya." -> HASIL: [KOSONG] (Itu tugas reminder, bukan memori)
    User: "Gw tuh sebenernya alergi debu tau." -> HASIL: [[SAVEMEMORY: Tami alergi debu]]
    User: "Motor Vario gw mogok lagi." -> HASIL: [[SAVEMEMORY: Motor Tami adalah Vario]]
    User: "Si Dini ulang tahun bulan depan." -> HASIL: [[SAVEMEMORY: Pacar Tami bernama Dini]]

    CHAT USER SEKARANG:
    "${text}"

    OUTPUT:
    Jika masuk Kategori Sampah ATAU Duplikat, output kosong saja.
    Jika masuk Kategori Emas DAN Baru, output HANYA kode [[SAVEMEMORY: ...]].
    `;

    try {
        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        // 3. Eksekusi Simpan
        if (response.includes('[[SAVEMEMORY:')) {
            let memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();

            // Filter Terakhir: Kalau memori terlalu panjang (>10 kata), biasanya itu AI halusinasi ngerangkum curhat. Buang.
            if (memory.split(' ').length > 10) return;

            console.log(`🧠 [STRICT-LEARN] Fakta Valid: ${memory}`);
            db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

            // --- [BARU] LAPOR KE NOMOR KEDUA --- 👇
            if (config.system && config.system.logNumber) {
                // Pake try-catch biar kalau gagal kirim log, bot gak crash
                try {
                    await client.sendMessage(config.system.logNumber, `🧠 *SILENT LEARN*\n\n👤 Subjek: ${namaPengirim}\n📝 Fakta: "${memory}"`);
                } catch (err) {
                    console.error("Gagal lapor log:", err);
                }
            }
            // -----------------------------------
        }
    } catch (e) { }
};

// --- FUNGSI INTERAKSI UTAMA (JAWAB CHAT + GAMBAR) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. CEK COMMAND MANUAL (!INGAT)
    if (text === '!ingat' || text.startsWith('!ingat ')) {
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