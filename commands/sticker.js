/* global Buffer */
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const ffmpeg = require('fluent-ffmpeg');

const toWebp = (inputPath, outputPath) => new Promise((resolve, reject) => {
    ffmpeg(inputPath)
        .outputOptions([
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
            '-vcodec', 'libwebp',
            '-lossless', '0',
            '-compression_level', '6',
            '-q:v', '50',
            '-loop', '0',
            '-preset', 'default',
            '-an', '-vsync', '0'
        ])
        .toFormat('webp')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
});

module.exports = async (client, msg) => {
    if (msg.hasMedia) {
        try {
            await react(msg, '⏳');

            const media = await downloadMedia(msg);
            if (!media) {
                await react(msg, '❌');
                return msg.reply('❌ Gagal download media.');
            }

            // Kalau udah WEBP, langsung kirim (skip convert, avoid Puppeteer crash)
            if (media.mimetype.includes('webp')) {
                await msg.reply(media, undefined, {
                    sendMediaAsSticker: true,
                    stickerAuthor: 'ig: @khataaam_',
                    stickerName: 'JikaeL the Creator'
                });
                await react(msg, '✅');
                return;
            }

            // Convert ke WEBP pake ffmpeg (Node.js side, bukan Puppeteer)
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const ext = media.mimetype.includes('png') ? 'png' : 'jpg';
            const inputPath = path.join(tempDir, `stk_in_${Date.now()}.${ext}`);
            const outputPath = path.join(tempDir, `stk_out_${Date.now()}.webp`);

            fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));
            await toWebp(inputPath, outputPath);

            // Kirim WEBP — formatImageToWebpSticker bakal return early (gak crash)
            const webpMedia = MessageMedia.fromFilePath(outputPath);
            await msg.reply(webpMedia, undefined, {
                sendMediaAsSticker: true,
                stickerAuthor: 'ig: @khataaam_',
                stickerName: 'JikaeL the Creator'
            });

            // Cleanup
            try { fs.unlinkSync(inputPath); } catch { /* ignore */ }
            try { fs.unlinkSync(outputPath); } catch { /* ignore */ }

            await react(msg, '✅');
        } catch (e) {
            logger.error("Sticker Error:", e.message || e);
            await react(msg, '❌');
            await msg.reply('❌ Gagal bikin stiker.');
        }
    } else {
        await msg.reply('Kirim gambar pake caption !sticker');
    }
};
module.exports.metadata = { category: "MEDIA", commands: [{ command: '!sticker', desc: 'Bikin Stiker', isPublic: true }] };