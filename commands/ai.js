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
    const triggers = ['suka', 'benci', 'mau', 'pengen', 'sedih', 'senang', 'marah', 'lapar', 'sakit', 'hari ini', 'besok', 'kemarin'];
    if (!triggers.some(w => text.toLowerCase().includes(w))) return;

    try {
        // Ambil 5 chat terakhir buat konteks
        const history = await ChatLog.getHistory(5);

        const prompt = `
        Tugas: Ekstrak FAKTA PERSONAL USER (${namaPengirim}).
        Konteks Chat: 
        ${history}
        
        Chat Baru: "${text}"
        
        Aturan:
        1. Cari fakta baru tentang user atau pacarnya (Dini).
        2. Format Output: [[SAVEMEMORY: Fakta Singkat]].
        3. Jika tidak ada fakta penting, kosongkan output.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const match = responseText.match(/\[\[SAVEMEMORY:\s*(.*?)\]\]/);

        if (match && match[1]) {
            const fakta = `[${namaPengirim}] ${match[1].trim()}`;

            // Simpan ke Database lewat Model
            const success = await Memory.add(fakta);

            // 🔥 LAPOR BOS (Log Number)
            if (success && config.system?.logNumber) {
                client.sendMessage(config.system.logNumber, `📝 *Ingatan Baru Tercipta:*\n"${fakta}"`).catch(() => { });
            }
        }
    } catch (e) {
        // Silent error biar log bersih
    }
};

// --- 2. INTERACT (HANDLE COMMAND !ai, !ingat, !setpersona) ---
const interact = async (client, msg, args, senderId, namaPengirim, text) => {
    const command = args[0].toLowerCase();
    // Ambil isi pesan setelah command
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
        await Memory.add(`[Manual] ${content}`);
        return msg.reply("✅ Ingatan disimpan ke otak.");
    }

    // --- C. COMMAND !ai / !analisa ---
    if (command === '!ai' || command === '!analisa') {
        if (!content) return msg.reply("Mau nanya apa? Ketik: !ai pertanyaanmu");

        await msg.react('👀');
        try {
            // Ambil semua bekal buat AI (Persona + Memori + Chat History)
            const persona = await Memory.getPersona();
            const memories = await Memory.getAll(15);
            const history = await ChatLog.getHistory(10);

            const memText = memories.map(m => `- ${m.fakta}`).join('\n');

            const finalPrompt = `
            [SYSTEM]: ${persona}
            
            [INGATAN JANGKA PANJANG]:
            ${memText}
            
            [RIWAYAT CHAT TERAKHIR]:
            ${history}
            
            [PERTANYAAN USER]: "${content}"
            
            Jawab secara natural sesuai persona di atas.
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