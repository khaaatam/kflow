const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Inisialisasi Gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

// --- FUNGSI PENCATAT RAHASIA (SMART OBSERVER V5 - ANTI FORWARD) ---
// Perhatikan: Parameter ke-2 sekarang 'msg', bukan 'text'
// --- FUNGSI PENCATAT RAHASIA (SMART OBSERVER V5 - FINAL) ---
const observe = async (client, msg, db, namaPengirim) => {
    const text = msg.body; // Ambil text dari message object

    // 1. CEK STATUS FORWARD 🚫 (Anti Hoax)
    if (msg.isForwarded) return;

    // 2. GATEKEEPER 📏 (Biar gak nyampah)
    if (text.length < 5) return;

    // 3. KEYWORD CHECKER 🔑
    const triggerWords = [
        'aku', 'gw', 'saya', 'gua',
        'suka', 'benci', 'gasuka', 'ga suka', 'gemar', 'hobi',
        'takut', 'phobia', 'fobia', 'alergi',
        'pengen', 'mau', 'cita-cita', 'mimpi',
        'rumah', 'tinggal', 'anak', 'lahir', 'ultah', 'umur',
        'panggil', 'nama', 'julukan',
        'jangan'
    ];

    const isImportant = triggerWords.some(word => text.toLowerCase().includes(word));
    if (!isImportant) return;

    // 4. AMBIL INGATAN LAMA (Context)
    const existingFacts = await new Promise((resolve) => {
        db.query("SELECT fakta FROM memori", (err, rows) => {
            if (err || !rows || rows.length === 0) resolve("");
            else resolve(rows.map(row => `- ${row.fakta}`).join("\n"));
        });
    });

    // 5. PROMPT DETECTIVE 🕵️
    const promptObserver = `
    Role: Filter Data Intelijen.
    Tugas: Tentukan apakah pesan ini LAYAK disimpan sebagai FAKTA PERMANEN.
    
    [PESAN USER]
    Pengirim: ${namaPengirim}
    Isi: "${text}"
    
    [DATABASE LAMA]
    ${existingFacts}
    
    [ATURAN]
    1. ABAIKAN Chat Sesaat / Kondisi Sementara.
    2. AMBIL Fakta Permanen / Preferensi.
    3. CEK SUBJEK: Pastikan yang dibahas adalah ${namaPengirim}.
    
    OUTPUT: [[SAVEMEMORY: ...]] atau KOSONG.
    `;

    try {
        const result = await model.generateContent(promptObserver);
        const response = result.response.text().trim();

        if (response.includes('[[SAVEMEMORY:')) {
            let memory = response.split('[[SAVEMEMORY:')[1].replace(']]', '').trim();
            
            // Filter tambahan
            if (memory.toLowerCase().includes('sedang') || memory.toLowerCase().includes('lagi ')) return;

            console.log(`🧠 [STRICT-LEARN] Fakta Disimpan: ${memory}`);
            
            // Simpan ke Database
            db.query("INSERT INTO memori (fakta) VALUES (?)", [memory]);

            // 🔥 LOG KE WA (Sesuai request lu biar masuk ke nomor kedua)
            if (config.system && config.system.logNumber) {
                try { 
                    await client.sendMessage(config.system.logNumber, `📝 *MEMORI BARU:*\n"${memory}"`); 
                } catch (e) {
                    console.error("❌ Gagal lapor ke WA:", e.message);
                }
            }
        }
    } catch (e) { 
        console.error("❌ Error AI Observer:", e.message);
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