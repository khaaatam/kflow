/* global Buffer */
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');
const ffmpeg = require('fluent-ffmpeg');

module.exports = async (client, msg) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply('Reply/kirim sticker pake caption `!toimg`');
    }

    await react(msg, '🔄');

    try {
        const targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await downloadMedia(targetMsg);
        if (!media) return msg.reply('❌ Gagal download media.');

        const isSticker = media.mimetype?.includes('webp') || targetMsg.type === 'sticker';
        if (!isSticker) return msg.reply('❌ Itu bukan sticker!');

        const inputPath = tempPath('toimg_in', 'webp');
        const outputPath = tempPath('toimg_out', 'jpg');
        fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions(['-y'])
                .toFormat('jpg')
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        const resultMedia = MessageMedia.fromFilePath(outputPath);
        await msg.reply(resultMedia, undefined, { caption: '🖼️ Converted from sticker' });
        cleanupFiles(inputPath, outputPath);
        await react(msg, '✅');
    } catch (e) {
        logger.error('ToImg Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!toimg', desc: 'Convert sticker ke gambar', isPublic: true }],
};
