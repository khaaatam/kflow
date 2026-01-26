const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// Init AI
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    // 1. CEK TRIGGER (!saran)
    if (text.toLowerCase() !== '!saran') return false;

    console.log("🧠 Command !saran triggered. Memanggil dukun cinta...");
    await client.sendMessage(msg.from, "🔮 _Sebentar, sedang meracik kata-kata sakti..._");

    // 2. TARIK KONTEKS (15 Chat Terakhir)
    // Kita butuh tau alur obrolannya biar sarannya NYAMBUNG.
    const chatHistory = await new Promise((resolve) => {
        const query = "SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 15";
        db.query(query, (err, rows) => {
            if (err || !rows || rows.length === 0) resolve("");
            else {
                // Format: "Dini: Kamu kemana aja?"
                const history = rows.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");
                resolve(history);
            }
        });
    });

    if (!chatHistory) {
        return client.sendMessage(msg.from, "❌ Belum ada riwayat chat buat dianalisa.");
    }

    // 3. PROMPT "DATING COACH" 💘
    const prompt = `
    Role: Dating Coach & Communication Expert (Spesialis Hubungan Gen-Z).
    Task: Berikan 3 OPSI BALASAN untuk pesan terakhir di bawah ini.

    [RIWAYAT CHAT (KONTEKS)]
    ${chatHistory}

    [INSTRUKSI]:
    - Analisa mood percakapan (Apakah lagi tegang, santai, atau romantis?).
    - Buat 3 variasi jawaban yang natural (Bahasa santai/gaul, JANGAN KAKU kayak robot).
    - Jangan terlalu panjang, sesuaikan dengan gaya chatting anak muda di WhatsApp.

    [FORMAT OUTPUT]:
    Berikan output dalam format JSON seperti ini (tanpa markdown lain):
    {
      "analisa": "Satu kalimat singkat tentang mood Dini sekarang (misal: Dia lagi butuh perhatian).",
      "opsi": [
        { "tipe": "😎 COOL / JAIM", "isi": "Jawaban yang singkat, padat, misterius, gak keliatan needy." },
        { "tipe": "🥺 SOFT / BUCIN", "isi": "Jawaban yang manis, pengertian, validasi perasaan dia." },
        { "tipe": "🤣 LAWAK / ASIK", "isi": "Jawaban humoris buat nyairin suasana atau nge-roasting dikit." }
      ]
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Bersihin markdown json ```json ... ``` kalau ada
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

        // 4. FORMAT PESAN WA
        let reply = `🧠 *ANALISA DUKUN CINTA:*\n"_${data.analisa}_"\n\n`;
        
        data.opsi.forEach(opt => {
            reply += `*${opt.tipe}*\n👉 ${opt.isi}\n\n`;
        });

        reply += `_Pilih yang sesuai situasi, Bang!_`;

        await client.sendMessage(msg.from, reply);

    } catch (error) {
        console.error("AI Error:", error);
        await client.sendMessage(msg.from, "❌ Gagal konek ke otak cinta. Coba lagi.");
    }

    return true;
};

module.exports.metadata = {
    category: "AI",
    commands: [
        { command: '!saran', desc: 'Minta 3 opsi balasan chat ke ayang' }
    ]
};