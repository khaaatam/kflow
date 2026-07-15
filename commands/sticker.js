module.exports = async (client, msg) => {
    if (msg.hasMedia) {
        try {
            await msg.react('⏳');
            const media = await msg.downloadMedia();
            await msg.reply(media, {
                sendMediaAsSticker: true,
                stickerAuthor: 'ig: @khataaam_',
                stickerName: 'JikaeL the Creator'
            });
            await msg.react('✅');
        } catch (e) { await msg.react('❌'); msg.reply('❌ Gagal bikin stiker.'); }
    } else { msg.reply('Kirim gambar pake caption !sticker'); }
};
module.exports.metadata = { category: "MEDIA", commands: [{ command: '!sticker', desc: 'Bikin Stiker', isPublic: true }] };