const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config');
const genAI = new GoogleGenerativeAI(config.ai.apiKey);
const model = genAI.getGenerativeModel({ model: config.ai.modelName });

module.exports = async (client, msg, text, db) => {
    if (!text.toLowerCase().startsWith('!tami')) return false;
    await msg.react('😎');

    let userProblem = text.replace('!tami', '').trim();
    if (msg.hasQuotedMsg) {
        const quoted = await msg.getQuotedMessage();
        userProblem = `(Konteks: "${quoted.body}")\n\nRespon: ${userProblem}`;
    }

    try {
        // 1. TARIK SAMPEL (Async)
        const [rowsSample] = await db.query(`
            SELECT pesan FROM (
                SELECT pesan FROM full_chat_logs 
                WHERE nama_pengirim LIKE '%Tami%' 
                AND pesan NOT LIKE '!%' 
                AND is_forwarded = 0 
                AND LENGTH(pesan) > 5 
                ORDER BY id DESC LIMIT 300 
            ) AS subquery
            ORDER BY RAND() LIMIT 40 
        `);
        const tamiStyle = rowsSample.map(r => r.pesan).join("\n");

        // 2. KONTEKS TERAKHIR (Async)
        const [rowsContext] = await db.query("SELECT nama_pengirim, pesan FROM full_chat_logs ORDER BY id DESC LIMIT 10");
        const chatContext = rowsContext.reverse().map(r => `${r.nama_pengirim}: "${r.pesan}"`).join("\n");

        const prompt = `
        Role: CLONE TEXT TAMI.
        Sampel Gaya Tami: \n${tamiStyle}\n
        Konteks Chat: \n${chatContext}\n
        Pesan Lawan: "${userProblem}"
        Tiru gaya ketikan Tami persis (singkatan, huruf kecil).
        `;

        const result = await model.generateContent(prompt);
        let response = result.response.text().trim();

        // Formatting dasar
        response = response.toLowerCase().replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ' ');
        if (response.endsWith('.')) response = response.slice(0, -1);

        await client.sendMessage(msg.from, response);

    } catch (error) {
        console.error("Cloning Error:", error);
    }
    return true;
};

module.exports.metadata = { category: "AI", commands: [{ command: '!tami', desc: 'Clone Tami' }] };