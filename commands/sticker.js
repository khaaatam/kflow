/* global Buffer */
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
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

            // Simpan ke file dulu, lalu kirim dari file (lebih stable di Termux)
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const ext = media.mimetype.includes('png') ? 'png' : media.mimetype.includes('gif') ? 'gif' : 'jpg';
            const tempFile = path.join(tempDir, `sticker_${Date.now()}.${ext}`);
            fs.writeFileSync(tempFile, Buffer.from(media.data, 'base64'));

            const stickerMedia = MessageMedia.fromFilePath(tempFile);
            await msg.reply(stickerMedia, undefined, {
                sendMediaAsSticker: true,
                stickerAuthor: 'ig: @khataaam_',
                stickerName: 'JikaeL the Creator'
            });

            // Cleanup
            try { fs.unlinkSync(tempFile); } catch { /* ignore */ }

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