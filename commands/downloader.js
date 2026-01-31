const { dl } = require('../lib/scraper');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    // Ambil url dari argument atau text full
    const url = args[0] || text;

    try {
        await msg.react('⏳');

        // Proses Download
        const data = await dl(url);

        if (!data) return msg.reply("❌ Gagal download. Link diprivate atau scraper lagi turu.");

        // Kirim Media (Tanpa Link di Caption)
        await client.sendMessage(msg.from, data.media, {
            // 👇 Caption simpel, gak usah balikin link lagi
            caption: `✅ *Download Sukses*\n📂 Tipe: ${data.type}`,
            quotedMessageId: msg.id._serialized // Tetep reply pesan asli lu
        });

        await msg.react('✅');

    } catch (e) {
        console.error("Downloader Error:", e);
        await msg.react('❌');
    }
};

module.exports.metadata = {
    category: "TOOLS",
    commands: [
        { command: '!dl', desc: 'Download media (TikTok/IG/FB)' },
        { command: '!tiktok', desc: 'Tiktok Downloader' },
        { command: '!fb', desc: 'Facebook Downloader' },
        { command: '!ig', desc: 'Instagram Downloader' },
        { command: '(auto detect)', desc: 'Auto Downloader Link' }
    ]
};