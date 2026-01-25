const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- FUNGSI PENCATAT RAHASIA (SMART OBSERVER V10 - STRICT SELECTIVE) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body;

    // 1. GATEKEEPER AWAL (Filter Sampah)
    // Kalau cuma "wkwk", "oke", "siap" -> Skip. Minimal 5 huruf.
    if (text.length < 5) return;

    // 2. KEYWORD CHECKER (Hanya proses kalau ada potensi fakta)
    const triggerWords = [
        'aku', 'gw', 'saya', 'gua',
        'suka', 'benci', 'gasuka', 'ga suka', 'gemar', 'hobi',
        'takut', 'phobia', 'fobia', 'alergi',
        'pengen', 'mau', 'cita-cita', 'mimpi',
        'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur',
        'panggil', 'nama', 'julukan',
        'jangan', 'kecewa', 'senang', 'marah', 'sedih', 'bete', 'kesel',
        'setuju', 'bener', 'valid'
    ];
    // Kalau gak ada keyword di atas, gak usah buang-buang token AI.
    if (!triggerWords.some(word => text.toLowerCase().includes(word))) return;

    // 🔥 TARIK 15 CHAT TERAKHIR (KONTEKS UTUH) 🔥
    const contextHistory = await new Promise((resolve) => {
        // Kita perlu tau mana yg Forwarded buat bahan pertimbangan AI
        db.query(
            "SELECT nama_pengirim, pesan, is_forwarded FROM full_chat_logs ORDER BY id DESC LIMIT 15",
            (err, rows) => {
                if (err || !rows || rows.length === 0) resolve("");
                else {
                    const history = rows.reverse().map(r => {
                        // Label ini PENTING buat AI mikir
                        const label = r.is_forwarded ? "[FORWARDED/DARI ORANG LAIN]" : "[KETIKAN SENDIRI]";
                        return `${r.nama_pengirim} ${label}: "${r.pesan}"`;
                    }).join("\n");
                    resolve(history);
                }
            }
        );
    });

    // AMBIL MEMORI LAMA (Biar gak duplikat/kontradiksi)
    const existingFacts = await new Promise((resolve) => {
        db.query("SELECT fakta FROM memori", (err, rows) => {
            if (err || !rows || rows.length === 0) resolve("");
            else resolve(rows.map(row => `- ${row.fakta}`).join("\n"));
        });
    });

    // 🔥 PROMPT HAKIM AGUNG (STRICT FILTER) 🔥
    const promptObserver = `
    Role: Hakim Validitas Data.
    Tugas: Menganalisa apakah pesan TERBARU dari ${namaPengirim} wajib disimpan sebagai FAKTA PERMANEN atau TIDAK.

    [RIWAYAT CHAT (KONTEKS)]
    ${contextHistory}
    
    [PESAN SAAT INI]
    ${namaPengirim} [KETIKAN SENDIRI]: "${text}"

    [DATABASE MEMORI LAMA]
    ${existingFacts}

    [INSTRUKSI PENILAIAN]:
    Pelajari hubungan antara [PESAN SAAT INI] dengan [RIWAYAT CHAT].
    
    1. **KASUS FORWARDED MESSAGES:**
       - JANGAN abaikan pesan [FORWARDED]. Gunakan sebagai KONTEKS.
       - Jika ${namaPengirim} me-reply pesan [FORWARDED] dengan kata-kata persetujuan ("Nah ini bener", "Aku juga gitu") -> **SIMPAN** (Artinya ${namaPengirim} mengakui isi forward itu sebagai fakta dirinya).
       - Jika ${namaPengirim} me-reply dengan reaksi kaget/jijik/tidak setuju ("Ih kok gitu", "Jahat banget") -> **JANGAN SIMPAN** (Itu cuma komentar).

    2. **KASUS DRAFT/ROLEPLAY:**
       - Jika konteks sebelumnya menunjukkan ${namaPengirim} sedang membuatkan chat untuk orang lain ("bilang gini aja", "coba forward ini") -> **JANGAN SIMPAN**.

    3. **KASUS CURHAT LANGSUNG:**
       - Jika tidak ada pemicu forward/draft, dan ${namaPengirim} menyatakan fakta tentang dirinya -> **SIMPAN**.

    OUTPUT FINAL (WAJIB PILIH SATU):
    - Jika TIDAK PENTING / HANYA KOMENTAR / DRAFT: Output kosong (diam).
    - Jika PENTING & VALID JADI FAKTA: Output format [[SAVEMEMORY: Fakta Singkat Padat]]
    `;

    try {
        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        if (response.includes('[[SAVEMEMORY:')) {
            let memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();

            // Filter receh terakhir
            if (memory.toLowerCase().includes('sedang') || memory.toLowerCase().includes('lagi ')) return;

            // CEK DUPLIKASI DI DATABASE
            db.query("SELECT id FROM memori WHERE fakta = ?", [memory], async (err, rows) => {
                if (!err && rows.length > 0) {
                    console.log(`♻️ [SKIP DUPLIKAT] ${memory}`);
                    return;
                }

                console.log(`🧠 [MEMORI BARU] ${memory}`);
                db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

                // Lapor ke WA Log
                if (config.system && config.system.logNumber) {
                    try { await client.sendMessage(config.system.logNumber, `📝 *MEMORI BARU:*\n"${memory}"`); } catch (e) { }
                }
            });
        }
    } catch (e) {
        // Silent error biar gak nyampah console
    }
};

// --- FUNGSI INTERAKSI UTAMA (THE BRAIN) ---
const interact = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // 1. HANDLE MANUAL INPUT (!INGAT)
    if (text.startsWith('!ingat ')) {
        const faktaBaru = msg.body.replace(/!ingat/i, '').trim();
        if (!faktaBaru) return client.sendMessage(chatDestination, "Apa yang harus gw inget Bang?");
        db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], (err) => {
            if (!err) client.sendMessage(chatDestination, `✅ Oke, gw catet: "${faktaBaru}"`);
        });
        return;
    }

    // 2. HANDLE TANYA JAWAB (!AI / !ANALISA)
    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        let promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();

        // A. Handling Gambar
        let imagePart = null;
        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media && media.mimetype.startsWith('image/')) {
                    imagePart = { inlineData: { data: media.data, mimeType: media.mimetype } };
                    if (!promptUser) promptUser = "Jelasin gambar ini";
                }
            } catch (error) { return client.sendMessage(chatDestination, "❌ Gagal baca gambar."); }
        }
        if (!promptUser && !imagePart) return client.sendMessage(chatDestination, "Mau diskusi apa?");

        await msg.react('👀');

        // B. Tarik Context (RAG)
        const getMemori = new Promise(r => db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 20", (err, res) => r(err ? [] : res)));
        const getHistory = new Promise(r => db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 20", (err, res) => r(err ? [] : res.reverse())));
        const [m, h] = await Promise.all([getMemori, getHistory]);

        const textM = m.map(x => `- ${x.fakta}`).join("\n");
        const textH = h.map(x => `${x.nama_pengirim}: ${x.pesan}`).join("\n");

        // C. THE ULTIMATE PROMPT (IDENTITY FIREWALL + SMART ADDRESSING) 🔥 
        const finalPrompt = `
        === IDENTITAS & ATURAN MUTLAK ===
        Kamu adalah "Bot-Duit", asisten pribadi.
        Lawan bicaramu SAAT INI adalah: **${namaPengirim}**. (FOKUS KE DIA!)

        [MEMORI FAKTA & PREFERENSI]
        ${textM}

        [HISTORY CHAT TERAKHIR]
        ${textH}

        [ATURAN LOGIKA & KEPRIBADIAN]
        1. **PISAHKAN IDENTITAS:**
           - Jika User saat ini (${namaPengirim}) minta dipanggil X, patuhi HANYA UNTUK DIA.
           - Fakta tentang orang lain (misal fakta Dini) JANGAN TERAPKAN ke ${namaPengirim} kecuali diminta.
           - Jangan mencampuradukkan preferensi Tami dan Dini.

        2. **GAYA BICARA & PANGGILAN:**
           - Santai, gaul, akrab (Lo/Gw).
           - Sedikit sarkas tapi membantu.
           - **PENTING:** Panggil ${namaPengirim} sesuai request dia di memori. 
           - **DEFAULT:** Jika tidak ada request khusus, panggil nama aslinya saja ("${namaPengirim}") TANPA embel-embel "Bang/Kak", kecuali dia minta.

        [PERMINTAAN USER (${namaPengirim})]
        "${promptUser}"
        `;

        try {
            const payload = imagePart ? [finalPrompt, imagePart] : [finalPrompt];
            const result = await model.generateContent(payload);
            const response = result.response.text().trim();
            await client.sendMessage(chatDestination, response);
        } catch (error) {
            console.error("AI Error:", error);
            await client.sendMessage(chatDestination, "🤕 Otak gw nge-lag. Tanya lagi dong.");
        }
    }
};

module.exports = { interact, observe };

// METADATA UNTUK MENU OTOMATIS
module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai [tanya]', desc: 'Tanya Gemini AI (Bisa kirim gambar)' },
        { command: '!ingat [fakta]', desc: 'Ajari AI fakta baru' },
        { command: '!analisa', desc: 'Analisa gambar/chat' }
    ]
};