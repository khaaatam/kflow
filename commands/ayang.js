const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');

const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, db, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;

    let namaTarget = "";
    if (namaPengirim.toLowerCase().includes("tami")) namaTarget = "Dini";
    else if (namaPengirim.toLowerCase().includes("dini")) namaTarget = "Tami";
    else return client.sendMessage(chatDestination, "Ciyee jomblo ya? 🤪");

    try {
        // TARIK HISTORY (Async/Await)
        const [rows] = await db.query(
            "SELECT pesan, waktu, is_forwarded FROM full_chat_logs WHERE nama_pengirim LIKE ? ORDER BY id DESC LIMIT 15",
            [`%${namaTarget}%`]
        );

        if (!rows || rows.length === 0) {
            return client.sendMessage(chatDestination, `Waduh, ${namaTarget} belum ada chat sama sekali.`);
        }

        const targetHistory = rows.map(r => {
            const label = r.is_forwarded ? "[FWD] " : "";
            return `[${r.waktu}] ${label}${r.pesan}`;
        }).reverse().join("\n");

        const jamSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const prompt = `
        Role: Bestie santai.
        Tugas: Analisa kondisi ${namaTarget} berdasarkan chat terakhir & jam ${jamSekarang}.
        Chat Terakhir: ${targetHistory}
        Output: Satu paragraf pendek santai. Jangan sebut "Analisa".
        `;

        await msg.react('🔍');
        const result = await model.generateContent(prompt);
        await client.sendMessage(chatDestination, result.response.text());

    } catch (error) {
        console.error("Ayang Error:", error);
        await client.sendMessage(chatDestination, "Gagal konek satelit cinta.");
    }
};

module.exports.metadata = { category: "LAINNYA", commands: [{ command: '!ayang', desc: 'Cek kondisi ayang' }] };