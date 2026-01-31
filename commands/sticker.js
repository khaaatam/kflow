module.exports = async (client, msg, args) => {
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            await client.sendMessage(msg.from, media, {
                sendMediaAsSticker: true,
                stickerAuthor: 'ig: @khataaam_',
                stickerName: 'JikaeL the Creator'
            });
        } catch (e) { msg.reply('❌ Gagal bikin stiker.'); }
    } else { msg.reply('Kirim gambar pake caption !sticker'); }
};
module.exports.metadata = { category: "MEDIA", commands: [{ command: '!sticker', desc: 'Bikin Stiker' }] };