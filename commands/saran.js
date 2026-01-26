const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    if (text.toLowerCase() !== '!saran') return false;

    console.log("🧠 Command !saran triggered...");
    await client.sendMessage(msg.from, "🔮 _Sebentar, sedang meracik kata-kata sakti..._");

    try {
        // 1. TARIK KONTEKS (Async/Await)
        const [rows] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 15");

        if (!rows || rows.length === 0) {
            return client.sendMessage(msg.from, "❌ Belum ada riwayat chat buat dianalisa.");
        }

        const chatHistory = rows.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        // 2. PROMPT AI
        const prompt = `
        Role: Dating Coach & Communication Expert.
        Task: Berikan 3 OPSI BALASAN untuk pesan terakhir.
        
        [RIWAYAT CHAT]:
        ${chatHistory}

        [FORMAT JSON]:
        {
          "analisa": "Analisa singkat mood dia.",
          "opsi": [
            { "tipe": "😎 COOL", "isi": "Jawaban..." },
            { "tipe": "🥺 SOFT", "isi": "Jawaban..." },
            { "tipe": "🤣 ASIK", "isi": "Jawaban..." }
          ]
        }
        `;

        const result = await model.generateContent(prompt);
        const cleanJson = result.response.text().replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

        let reply = `🧠 *ANALISA DUKUN CINTA:*\n"_${data.analisa}_"\n\n`;
        data.opsi.forEach(opt => {
            reply += `*${opt.tipe}*\n👉 ${opt.isi}\n\n`;
        });
        reply += `_Pilih yang sesuai situasi!_`;

        await client.sendMessage(msg.from, reply);

    } catch (error) {
        console.error("AI Saran Error:", error);
        await client.sendMessage(msg.from, "❌ Gagal konek ke otak cinta.");
    }

    return true;
};

module.exports.metadata = {
    category: "AI",
    commands: [{ command: '!saran', desc: 'Minta 3 opsi balasan chat' }]
};