const logger = require('../lib/logger');

module.exports = async (client, msg) => {
    if (msg.hasMedia) {
        try {
            await msg.react('⏳');
            const media = await msg.downloadMedia();
            if (!media) {
                await msg.react('❌');
                return msg.reply('❌ Gagal download media.');
            }
            await client.sendMessage(msg.from, media, {
                sendMediaAsSticker: true,
                stickerAuthor: 'ig: @khataaam_',
                stickerName: 'JikaeL the Creator'
            });
            await msg.react('✅');
        } catch (e) {
            logger.error("Sticker Error:", e.message || e);
            await msg.react('❌');
            msg.reply('❌ Gagal bikin stiker.');
        }
    } else {
        msg.reply('Kirim gambar pake caption !sticker');
    }
};
module.exports.metadata = { category: "MEDIA", commands: [{ command: '!sticker', desc: 'Bikin Stiker', isPublic: true }] };