const model = require('../lib/ai');
const db = require('../lib/database');

module.exports = async (client, msg, args) => {
    await msg.react('🤔');
    try {
        let context = "";
        if (msg.hasQuotedMsg) {
            const quoted = await msg.getQuotedMessage();
            context = `[REPLY PESAN INI]: "${quoted.body}"`;
        }
        const [rows] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs WHERE pesan NOT LIKE '!%' ORDER BY id DESC LIMIT 10");
        const history = rows.reverse().map(r => `${r.nama_pengirim}: ${r.pesan}`).join('\n');

        const prompt = `Role: Teman curhat yang solutif.\nContext Chat:\n${history}\n${context}\nUser butuh saran balasan/solusi. Berikan 3 opsi balasan (Sopan, Santai, Lucu).`;

        const result = await model.generateContent(prompt);
        msg.reply(result.response.text());
    } catch (e) {
        console.error(e);
        msg.reply('Gagal mikir.');
    }
};
module.exports.metadata = { category: "AI", commands: [{ command: '!saran', desc: 'Minta saran balasan' }] };