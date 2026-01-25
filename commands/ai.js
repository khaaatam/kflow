const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- FUNGSI PENCATAT RAHASIA (SMART OBSERVER V4 - STRICT MODE) ---
const observe = async (client, text, db, namaPengirim) => {
    // 1. GATEKEEPER AWAL (Saring Sampah) 🗑️
    // Kalau text pendek banget, skip.
    if (text.length < 15) return;

    // 2. KEYWORD CHECKER (Hanya proses kalau ada kata "Penting") 🔑
    // Bot cuma bakal "melek" kalau lu ngomongin diri sendiri/preferensi.
    const triggerWords = [
        'aku', 'gw', 'saya', 'gua', // Self reference
        'suka', 'benci', 'gasuka', 'ga suka', 'gemar', 'hobi', // Preferensi
        'takut', 'phobia', 'fobia', 'alergi', // Ketakutan/Kesehatan
        'pengen', 'mau', 'cita-cita', 'mimpi', // Keinginan
        'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur', // Data Diri
        'panggil', 'nama', 'julukan', // Identitas
        'jangan' // Larangan
    ];

    // Cek apakah ada minimal SATU kata kunci di chat
    const isImportant = triggerWords.some(word => text.toLowerCase().includes(word));

    // Kalau gak ada kata penting, ABAIKAN. (Hemat API & Database)
    if (!isImportant) return;

    // 3. Ambil ingatan lama (biar gak duplikat)
    const existingFacts = await new Promise((resolve) => {
        db.query("SELECT fakta FROM memori", (err, rows) => {
            if (err || !rows || rows.length === 0) resolve("");
            else resolve(rows.map(row => `- ${row.fakta}`).join("\n"));
        });
    });

    // 4. PROMPT DETECTIVE (STRICT)
    const promptObserver = `
    Role: Filter Data Intelijen.
    Tugas: Tentukan apakah pesan ini LAYAK disimpan sebagai FAKTA PERMANEN (Jangka Panjang).

    [PESAN USER]
    Pengirim: ${namaPengirim}
    Isi: "${text}"

    [DATABASE LAMA]
    ${existingFacts}

    [ATURAN PENYARINGAN - STRICT]
    1. **ABAIKAN** Chat Sesaat / Kondisi Sementara.
       - Contoh SAMPAH: "Aku lagi makan", "Aku ngantuk", "Gw otw", "Sakit perut nih".
       - ALASAN: Itu cuma valid 1 jam. Besok udah basi. JANGAN DICATAT.
    2. **AMBIL** Fakta Permanen / Preferensi.
       - Contoh EMAS: "Aku alergi udang", "Gw benci duren", "Panggil gw Bos", "Ulang tahun gw 12 Mei".
       - ALASAN: Itu valid selamanya. CATAT INI.
    3. **CEK SUBJEK:** Pastikan yang dibahas adalah ${namaPengirim} atau orang terdekatnya.
    
    OUTPUT HARUS SALAH SATU:
    - Jika Sesaat/Sampah/Duplikat: OUTPUT KOSONG (JANGAN TULIS APA-APA).
    - Jika Penting & Permanen: [[SAVEMEMORY: Subjek + Predikat + Objek]]
    `;

    try {
        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        if (response.includes('[[SAVEMEMORY:')) {
            let memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();

            // Filter tambahan: Kalau masih nyatet kondisi "sedang/lagi", buang.
            if (memory.toLowerCase().includes('sedang') || memory.toLowerCase().includes('lagi ')) return;

            console.log(`🧠 [STRICT-LEARN] Fakta Disimpan: ${memory}`);
            db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

            // Notif ke Log Number biar lu tau dia nyatet apa
            if (config.system && config.system.logNumber) {
                try { await client.sendMessage(config.system.logNumber, `📝 *MEMORI BARU:* ${memory}`); } catch (e) { }
            }
        }
    } catch (e) { }
};

// --- FUNGSI INTERAKSI UTAMA (THE BRAIN) ---
const interact = async (client, msg, text, db, namaPengirim) => {
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