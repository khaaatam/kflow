const model = require('../lib/ai');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId, namaPengirim) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const pengirim = namaPengirim ? namaPengirim.toLowerCase() : "";

    let namaTarget = "";
    if (pengirim.includes("tami")) namaTarget = "Dini";
    else if (pengirim.includes("dini")) namaTarget = "Tami";
    else return client.sendMessage(chatDestination, "Kamu siapa? Gak kenal pasanganmu. 🤪");

    try {
        await msg.react('🔍');
        const [rows] = await db.query(
            "SELECT pesan, waktu FROM full_chat_logs WHERE nama_pengirim LIKE ? ORDER BY id DESC LIMIT 15",
            [`%${namaTarget}%`]
        );

        if (!rows || rows.length === 0) {
            return client.sendMessage(chatDestination, `Belum ada chat dari ${namaTarget}.`);
        }

        const history = rows.map(r => `[${r.waktu}] ${r.pesan}`).reverse().join("\n");
        const prompt = `Analisa mood ${namaTarget} berdasarkan chat ini:\n${history}\nSingkat, padat, gaya bestie.`;

        const result = await model.generateContent(prompt);
        await client.sendMessage(chatDestination, result.response.text());
    } catch (error) {
        console.error(error);
        msg.reply("Error database.");
    }
};
module.exports.metadata = { category: "LAINNYA", commands: [{ command: '!ayang', desc: 'Cek ayang' }] };