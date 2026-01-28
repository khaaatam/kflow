const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    if (text.toLowerCase() !== '!saran') return false;

    await msg.react('🤔');

    try {
        let specificContext = "";
        let chatHistory = "";
        let mode = "GENERAL"; // Default mode

        // --- 1. CEK APAKAH USER LAGI NGE-REPLY PESAN? ---
        if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            specificContext = `
            [PESAN YANG DI-REPLY USER SAAT INI]:
            "${quoted.body}"
            (User bingung mau bales apa ke pesan di atas ini)
            `;
            mode = "REPLY";
        }

        // --- 2. TARIK RIWAYAT CHAT (Buat Konteks Tambahan) ---
        // Kita tetep tarik history biar AI tau alur obrolan sebelumnya
        const [rows] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 10");
        if (rows && rows.length > 0) {
            chatHistory = rows.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");
        }

        // --- 3. PROMPT AI YANG LEBIH CERDAS ---
        const prompt = `
        Role: Dating Coach & Communication Expert (Bahasa Gaul Indonesia).
        Task: Kasih 3 opsi balasan yang pas.

        [RIWAYAT OBROLAN TERAKHIR]:
        ${chatHistory}

        ${specificContext}

        Instruksi:
        - Jika ada [PESAN YANG DI-REPLY], FOKUS cari balasan buat pesan itu.
        - Jika tidak ada, analisa history chat terakhir dan kasih saran topik/balasan selanjutnya.
        - Analisa singkat dulu situasinya (maksimal 2 kalimat).

        [FORMAT JSON WAJIB]:
        {
          "analisa": "Analisa situasi singkat...",
          "opsi": [
            { "tipe": "😎 COOL/SANTAI", "isi": "..." },
            { "tipe": "🥺 EMPATI/SOFT", "isi": "..." },
            { "tipe": "😏 FLIRTY/LUCU", "isi": "..." }
          ]
        }
        `;

        const result = await model.generateContent(prompt);
        const cleanJson = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

        let reply = `🧠 *ANALISA DUKUN CINTA (${mode})*\n"_${data.analisa}_"\n\n`;
        data.opsi.forEach(opt => {
            reply += `*${opt.tipe}*\n👉 ${opt.isi}\n\n`;
        });
        reply += `_Pilih yang paling pas!_`;

        await client.sendMessage(msg.from, reply);

    } catch (error) {
        console.error("AI Saran Error:", error);
        await client.sendMessage(msg.from, "❌ Gagal konek ke otak cinta.");
    }

    return true;
};

module.exports.metadata = {
    category: "AI",
    commands: [{ command: '!saran', desc: 'Minta saran balasan (Bisa Reply Chat)' }]
};