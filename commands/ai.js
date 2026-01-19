const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

// inisialisasi gemini
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    // --- FITUR 1: !INGAT (NAMBAH MEMORI) ---
    if (text.startsWith('!ingat')) {
        const faktaBaru = msg.body.replace(/!ingat/i, '').trim(); // pake msg.body biar case sensitive aman
        if (!faktaBaru) return client.sendMessage(chatDestination, "apa yang harus gw inget bos? contoh: `!ingat password wifi 12345`");

        db.query("INSERT INTO memori (fakta) VALUES (?)", [faktaBaru], (err) => {
            if (err) return client.sendMessage(chatDestination, "gagal simpen ke otak: " + err.message);
            client.sendMessage(chatDestination, "siap, udah gw catet di memori!");
        });
        return; // stop di sini
    }

    // --- FITUR 2: !AI / !ANALISA (TANYA JAWAB) ---
    if (text.startsWith('!ai') || text.startsWith('!analisa')) {
        const promptUser = msg.body.replace(/!ai|!analisa/i, '').trim();
        if (!promptUser) return client.sendMessage(chatDestination, "mau nanya apa?");

        await msg.react('🤖');

        // step 1: ambil 5 ingatan jangka panjang (fakta)
        const getMemori = new Promise((resolve) => {
            db.query("SELECT fakta FROM memori ORDER BY id DESC LIMIT 5", (err, rows) => resolve(err ? [] : rows));
        });

        // step 2: ambil 20 chat terakhir (history percakapan)
        // ini yang bikin dia 'nyambung' sama obrolan sebelumnya
        const getChatLogs = new Promise((resolve) => {
            db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 20", (err, rows) => {
                if (err || !rows) return resolve([]);
                // kita reverse biar urutannya dari lama ke baru (kronologis)
                resolve(rows.reverse());
            });
        });

        const [memoriData, chatData] = await Promise.all([getMemori, getChatLogs]);

        // format data buat prompt
        const textMemori = memoriData.map(m => `- ${m.fakta}`).join("\n");
        const textHistory = chatData.map(c => `${c.nama_pengirim}: ${c.pesan}`).join("\n");

        // rakit prompt super lengkap
        const finalPrompt = `
        role: asisten pribadi yang santai, pinter, dan agak sarkas dikit.
        user saat ini: ${namaPengirim}
        
        [ingatan tentang user]
        ${textMemori}

        [history chat terakhir]
        ${textHistory}
        
        [pertanyaan user]
        ${namaPengirim}: ${promptUser}

        instruksi: jawab pertanyaan user berdasarkan konteks history chat dan ingatan di atas. gaya bahasa gaul, pake 'gw/lu', jangan kaku.
        `;

        try {
            const result = await model.generateContent(finalPrompt);
            const response = await result.response;
            await client.sendMessage(chatDestination, response.text());
        } catch (error) {
            console.error("ai error:", error);
            await client.sendMessage(chatDestination, "aduh otak gw error bentar. coba lagi nanti.");
        }
    }
};