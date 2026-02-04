const model = require('../lib/ai');
const Memory = require('../models/Memory');
const ChatLog = require('../models/ChatLog');
const config = require('../config');

// ============================================================
// 🕵️‍♂️ 1. OBSERVER (MATA-MATA PEKA TANGGAL)
// ============================================================
const observe = async (client, msg, namaPengirim) => {
    const text = msg.body;

    // A. Filter Awal (Biar gak boros kuota AI)
    if (text.startsWith('!') || text.length < 5) return; // Skip command/chat pendek

    // B. Blacklist Kata
    const blacklist = ['bot', 'fitur', 'command', 'reset', 'menu', 'error', 'system'];
    if (blacklist.some(w => text.toLowerCase().includes(w))) return;

    // C. Cek Trigger Words (Kamus Peka)
    const triggers = [
        // Keinginan
        'mau', 'pengen', 'ingin', 'akan', 'rencana', 'niat', 'bakal',
        'besok', 'lusa', 'minggu depan', 'bulan depan', 'tahun depan',
        // Perasaan
        'suka', 'cinta', 'sayang', 'benci', 'takut', 'gasuka', 'gemar', 'hobi',
        // 🔥 Bucin & Relationship
        'jadian', 'pacar', 'pasangan', 'nikah', 'kawin', 'tunangan', 'lamaran',
        'putus', 'balikan', 'gebetan', 'mantan', 'crush',
        // 📅 Tanggal Penting
        'tanggal', 'hari', 'ulang tahun', 'ultah', 'hbd', 'anniv', 'anniversary',
        'ingetin', 'ingat', 'catet', 'catat'
    ];

    if (!triggers.some(w => text.toLowerCase().includes(w))) return; // Skip kalau gak ada trigger

    console.log(`🔍 [OBSERVER] Watching: "${msg.body.slice(0, 30)}..."`);

    try {
        // 👇 JAM TANGAN BUAT AI (Biar tau konteks waktu)
        const today = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // (History chat sebelumnya gak perlu dipake buat observer biar fokus ke chat ini aja)
        // Jadi kita hapus baris `const history` yang gak kepake di sini.

        const prompt = `
        [KONTEKS WAKTU]
        Hari ini: ${today}

        [TUGAS]
        Ekstrak FAKTA PENTING tentang user dari chat ini.
        User: "${namaPengirim}"
        Chat: "${text}"

        [ATURAN PENTING]
        1. Bandingkan tanggal di chat dengan "Hari ini".
           - Jika tanggal chat < Hari ini -> FAKTA MASA LALU (Sudah terjadi).
           - Jika tanggal chat > Hari ini -> RENCANA (Akan terjadi).
        2. Gunakan sudut pandang ketiga (Contoh: "User jadian tanggal...").
        3. Jika tidak penting/sampah, jawab "SKIP".
        `;

        const result = await model.generateContent(prompt);
        const fact = result.response.text().trim();

        if (fact.toUpperCase().includes("SKIP") || fact.length < 5) {
            // console.log(`❌ [DEBUG] AI bilang SKIP.`);
            return;
        }

        // Simpan ke Database
        await Memory.add(namaPengirim, fact);

        // LOGGING KEREN
        console.log(`\n🧠 INGATAN BARU TERCIPTA!`);
        console.log(`👤 User: ${namaPengirim}`);
        console.log(`📝 Fakta: ${fact}`);
        console.log(`-----------------------------------`);

        // Lapor Owner (Opsional)
        if (config.system && config.system.logNumber) {
            try {
                await client.sendMessage(config.system.logNumber,
                    `📝 *New Memory Unlocked!*\n👤 ${namaPengirim}\n🧠 ${fact}`
                );
            } catch (e) { }
        }
    } catch (err) {
        console.error("Observe Error:", err.message);
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