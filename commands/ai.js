const model = require('../lib/ai');
const Memory = require('../models/Memory');
const ChatLog = require('../models/ChatLog');
const config = require('../config');

// --- 1. OBSERVER (MATA-MATA BACKGROUND) ---
const observe = async (client, msg, namaPengirim) => {
    const text = msg.body;

    // Filter: Jangan proses command atau chat pendek
    if (text.startsWith('!') || text.length < 5) return;

    // Blacklist kata-kata teknis biar gak pusing
    const blacklist = ['bot', 'fitur', 'command', 'reset', 'menu', 'error'];
    if (blacklist.some(w => text.toLowerCase().includes(w))) return;

    // Trigger Words: Cuma proses kalau ada kata emosional/penting
    // (Bisa lu tambahin lagi kata kuncinya)
    const triggers = ['suka', 'benci', 'mau', 'pengen', 'sedih', 'senang', 'marah', 'lapar', 'sakit', 'hari ini', 'besok', 'kemarin', 'rencana', 'janji'];
    if (!triggers.some(w => text.toLowerCase().includes(w))) return;

    try {
        // Ambil 5 chat terakhir buat konteks
        const history = await ChatLog.getHistory(5);

        const prompt = `
        Analisa pesan ini dari pengguna bernama "${namaPengirim}".
        Konteks Chat Terakhir:
        ${history}
        
        Pesan Baru: "${text}"
        
        Tugasmu:
        1. Tentukan apakah pesan ini mengandung FAKTA PENTING tentang pengguna (seperti hobi, rencana, tanggal penting, kesukaan, kondisi fisik/mental).
        2. JANGAN catat sapaan, basa-basi, atau pertanyaan umum.
        3. Jika PENTING, tulis ulang faktanya dalam 1 kalimat singkat padat (Sudut pandang orang ketiga). HINDARI penggunaan kurung siku [].
        4. Jika TIDAK PENTING, jawab dengan kata "SKIP".
        
        Contoh Output Positif:
        Menyukai kopi hitam tanpa gula.
        
        Contoh Output Negatif:
        SKIP
        `;

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim();

        // Kalau AI bilang SKIP, ya udah biarin aja
        if (response.toUpperCase() === "SKIP") return;

        // Simpan ke Database lewat Model (Sekarang support User ID)
        // Kita kirim namaPengirim biar masuk ke kolom 'user'
        const success = await Memory.add(namaPengirim, response);

        if (success) {
            // 🔥 FORMAT LOG GANTENG (Sesuai Request)
            console.log(`\n🧠  Ingatan Baru`);
            console.log(`👤: *_${namaPengirim}_*`);
            console.log(`📝: ${response}`);
            console.log(`------------------------------------------------`);

            // Notif ke Owner (Opsional)
            if (config.system?.logNumber) {
                // client.sendMessage(config.system.logNumber, `📝 *Ingatan Baru:*\n👤 ${namaPengirim}\n📝 ${response}`).catch(() => { });
            }
        }

    } catch (e) {
        // Silent error biar log bersih
    }
};

// --- 2. INTERACT (HANDLE COMMAND !ai, !ingat, !setpersona) ---
const interact = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0].toLowerCase();
    const content = text.replace(command, '').trim();

    // --- A. COMMAND !setpersona ---
    if (command === '!setpersona') {
        if (!content) return msg.reply("Mana personanya? Contoh: !setpersona Kamu adalah Tami, cowok cool.");
        await Memory.setPersona(content);
        return msg.reply("✅ Persona AI berhasil diupdate!");
    }

    // --- B. COMMAND !ingat ---
    if (command === '!ingat') {
        if (!content) return msg.reply("Apa yang harus diingat? Contoh: !ingat Dini ulang tahun tanggal 6 Januari.");
        // Masukin manual, user-nya kita set "Manual" atau nama pengirim
        await Memory.add(namaPengirim, `[Manual] ${content}`);
        return msg.reply("✅ Ingatan disimpan ke otak.");
    }

    // --- C. COMMAND !ai / !analisa ---
    if (command === '!ai' || command === '!analisa') {
        if (!content) return msg.reply("Mau nanya apa? Ketik: !ai pertanyaanmu");

        await msg.react('👀');
        try {
            // Ambil semua bekal buat AI (Persona + Memori User Ini + Chat History)
            const persona = await Memory.getPersona();

            // Ambil memori KHUSUS user ini (Biar lebih personal)
            const memories = await Memory.getByUser(namaPengirim, 10);
            // Kalau mau memori global juga bisa dipanggil Memory.getAll(5)

            const history = await ChatLog.getHistory(10);

            const memText = memories.map(m => `- ${m.fakta}`).join('\n');

            const finalPrompt = `
            [SYSTEM]: ${persona}
            
            [INGATAN TENTANG ${namaPengirim}]:
            ${memText}
            
            [RIWAYAT CHAT TERAKHIR]:
            ${history}
            
            [PERTANYAAN USER (${namaPengirim})]: "${content}"
            
            Jawab secara natural, santai, dan personal sesuai data ingatan di atas.
            `;

            let payload = [finalPrompt];

            // Support Analisa Gambar
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
            msg.reply("❌ AI lagi pusing (Error).");
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