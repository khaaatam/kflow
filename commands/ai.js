const model = require('../lib/ai');
const Memory = require('../models/Memory');
const ChatLog = require('../models/ChatLog');
const config = require('../config');

// ============================================================
// 🕵️‍♂️ 1. OBSERVER (MATA-MATA PEKA TANGGAL)
// ============================================================
const observe = async (client, msg, namaPengirim) => {
    const text = msg.body;

    // --- LAYER 0: PRE-CHECK ---
    if (text.startsWith('!') || text.length < 5) return;
    const blacklist = ['bot', 'menu', 'error', 'system', 'reset', 'admin'];
    if (blacklist.some(w => text.toLowerCase().includes(w))) return;

    // --- LAYER 1: TRIGGER WORDS (SELEKSI KASAR) ---
    const triggers = [
        // Identitas & Relasi
        'nama', 'panggil', 'tinggal', 'kerja', 'sekolah', 'kuliah',
        'pacar', 'pasangan', 'istri', 'suami', 'nikah', 'jadian', 'mantan', 'tunangan',
        // Tanggal & Waktu
        'tanggal', 'hari', 'lahir', 'ultah', 'ulang tahun', 'anniv', 'anniversary', 'kapan',
        // Preferensi (Suka/Gak Suka)
        'suka', 'cinta', 'benci', 'gasuka', 'hobi', 'favorit', 'gemar', 'takut', 'alergi',
        // Rencana Masa Depan
        'rencana', 'niat', 'mau', 'pengen', 'akan', 'bakal', 'besok', 'lusa'
    ];

    // Kalau gak ada kata kunci di atas, langsung buang.
    if (!triggers.some(w => text.toLowerCase().includes(w))) return;

    console.log(`🔍 [OBSERVER] Kandidat Memori: "${text.slice(0, 30)}..."`);

    // --- LAYER 2: AI VALIDATION (SELEKSI HALUS) ---
    try {
        const today = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // 🔥 PROMPT INI JANTUNGNYA. KITA BIKIN LEBIH STRICT.
        const prompt = `
        Bertindaklah sebagai 'Memory Keeper' yang sangat selektif.
        Tugasmu menyaring percakapan User (${namaPengirim}) dan hanya mencatat FAKTA PERMANEN.

        [KONTEKS]
        Waktu Sekarang: ${today}
        Pesan User: "${text}"

        [KRITERIA PENILAIAN]
        ✅ SIMPAN JIKA:
        1. Fakta Biografis (Nama, Umur, Pekerjaan, Lokasi).
        2. Hubungan Personal (Nama Pasangan, Tanggal Jadian, Status Nikah).
        3. Tanggal Penting (Ulang Tahun, Anniversary).
        4. Preferensi Kuat (Makanan Favorit, Hobi Utama, Phobia).
        5. Rencana Konkret (Jadwal penerbangan, Janji temu).

        ❌ BUANG (SKIP) JIKA:
        1. Basa-basi/Sapaan ("Halo", "Lagi apa", "Wkwk").
        2. Perasaan Sesaat ("Lagi sedih nih", "Ngantuk", "Lapar").
        3. Komentar Umum ("Cuaca panas ya", "Filmnya bagus").
        4. Pertanyaan ke Bot ("Kamu siapa?", "Jam berapa?").

        [INSTRUKSI OUTPUT]
        - Jika masuk kategori SIMPAN: Tulis faktanya dalam 1 kalimat (Sudut pandang ke-3).
        - Jika masuk kategori BUANG: Tulis persis kata "SKIP".
        `;

        const result = await model.generateContent(prompt);
        const fact = result.response.text().trim();

        // Cek Respon AI
        if (fact.toUpperCase() === 'SKIP' || fact.includes('SKIP')) {
            // console.log("🗑️ [OBSERVER] Dibuang (Dianggap Sampah).");
            return;
        }

        // Simpan ke Database
        await Memory.add(namaPengirim, fact);

        console.log(`\n💾 [MEMORY SAVED]`);
        console.log(`👤 User: ${namaPengirim}`);
        console.log(`📝 Fakta: ${fact}`);
        console.log(`-----------------------------------`);

        // React tanda sukses nyatet
        await msg.react('🧠');

    } catch (err) {
        console.error("Observer Error:", err.message);
    }
};

// ============================================================
// 🤖 2. INTERACT (HANDLING COMMAND)
// ============================================================
const interact = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0].toLowerCase();
    const content = text.replace(command, '').trim();

    // --- A. COMMAND !setpersona ---
    if (command === '!setpersona') {
        if (!content) return msg.reply("Mana personanya? Contoh: `!setpersona Kamu adalah Tami, asisten pribadi yang galak.`");
        await Memory.setPersona(content);
        return msg.reply("✅ Persona AI berhasil diupdate!");
    }

    // --- B. COMMAND !ingat ---
    if (command === '!ingat') {
        if (!content) return msg.reply("Apa yang harus diingat? Contoh: `!ingat Dini ulang tahun tanggal 6 Januari.`");
        await Memory.add(namaPengirim, `[Manual] ${content}`);
        return msg.reply("✅ Sip, udah gw simpen di otak.");
    }

    // --- C. COMMAND !ai / !analisa ---
    if (command === '!ai' || command === '!analisa' || command === '!tanya') {
        if (!content) return msg.reply("Mau nanya apa? Ketik: `!ai pertanyaanmu`");

        await msg.react('🤖');
        try {
            // Context Loading...
            const persona = await Memory.getPersona();
            const memories = await Memory.getByUser(namaPengirim, 10);

            // 👇 History Chat (Di sini BARU KEPAKE buat konteks ngobrol)
            const chatHistory = await ChatLog.getHistory(10);

            const memText = memories.map(m => `- ${m.fakta}`).join('\n');

            // 👇 Inject Tanggal Hari Ini juga biar pas ngobrol dia tau waktu
            const today = new Date().toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const finalPrompt = `
            [SYSTEM INFO]
            Persona: ${persona}
            Hari ini: ${today}
            Lawan Bicara: ${namaPengirim}
            
            [INGATAN TENTANG ${namaPengirim.toUpperCase()}]
            ${memText || '(Belum ada ingatan khusus)'}
            
            [RIWAYAT CHAT TERAKHIR]
            ${chatHistory}
            
            [PERTANYAAN USER]: "${content}"
            
            Jawab secara natural, santai, dan personal. Jangan kaku.
            `;

            let payload = [finalPrompt];

            // Handle Gambar (Vision AI)
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                if (media.mimetype.startsWith('image/')) {
                    payload.push({ inlineData: { data: media.data, mimeType: media.mimetype } });
                }
            }

            const result = await model.generateContent(payload);
            const reply = result.response.text().replace(/^(Bot|AI):/i, '').trim();
            msg.reply(reply);

        } catch (e) {
            console.error("AI Interact Error:", e);
            msg.reply("❌ Otak lagi konslet bang. Coba lagi nanti.");
        }
    }
};

module.exports = { observe, interact };

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!ai', desc: 'Chat dengan AI (Memory + Context)' },
        { command: '!analisa', desc: 'Analisa gambar/teks' },
        { command: '!ingat', desc: 'Paksa simpan memori' },
        { command: '!setpersona', desc: 'Ganti sifat/roleplay AI' }
    ]
};