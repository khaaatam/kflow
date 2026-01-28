// commands/sticker.js
const config = require('../config');

module.exports = async (client, msg, text) => {
    try {
        // Cek: Apakah pesan ini ada medianya? Atau dia nge-reply pesan bermedia?
        const isMedia = msg.hasMedia;
        const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

        if (isMedia || isQuotedMedia) {
            // Kasih reaksi biar keliatan kerja
            await msg.react('⏳');

            // Tentukan target: Ambil dari pesan sendiri atau pesan yang di-reply
            let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
            
            // Download Media (Gambar/Video/Gif)
            const media = await targetMsg.downloadMedia();
            if (!media) return client.sendMessage(msg.from, "❌ Gagal download gambar.");

            // Kirim Balik Jadi Sticker
            // Note: Sticker Author & Name bisa lu ganti sesuka hati di config atau hardcode disini
            await client.sendMessage(msg.from, media, {
                sendMediaAsSticker: true,
                stickerAuthor: 'K-Flow Bot', 
                stickerName: 'Created by Tami',
                stickerCategories: ['🤖']
            });

            await msg.react('✅');
        } else {
            await client.sendMessage(msg.from, "⚠️ Caranya: Kirim gambar pake caption *!s* atau Reply gambar orang pake *!s*");
        }
        return true;

    } catch (error) {
        console.error("Sticker Error:", error);
        await msg.reply("❌ Gagal. Pastikan file tidak terlalu besar atau corrupt.");
        return true;
    }
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [
        { command: '!s', desc: 'Convert Gambar ke Stiker' },
        { command: '!sticker', desc: 'Convert Gambar ke Stiker' }
    ]
};