/* global Buffer */
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { MessageMedia } = require('whatsapp-web.js');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');
const fs = require('fs');

module.exports = async (client, msg) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply('Reply/kirim animated sticker pake caption `!vsticker`');
    }

    await react(msg, '🔄');

    try {
        const targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await downloadMedia(targetMsg);
        if (!media) return msg.reply('❌ Gagal download media.');

        const isSticker = media.mimetype?.includes('webp') || targetMsg.type === 'sticker';
        if (!isSticker) return msg.reply('❌ Itu bukan sticker!');

        const inputPath = tempPath('vstk_in', 'webp');
        const outputPath = tempPath('vstk_out', 'mp4');
        fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-vf', 'scale=480:480:force_original_aspect_ratio=decrease,pad=480:480:(ow-iw)/2:(oh-ih)/2',
                    '-c:v libx264', '-preset ultrafast',
                    '-pix_fmt yuv420p',
                    '-an',
                ])
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        const resultMedia = MessageMedia.fromFilePath(outputPath);
        await msg.reply(resultMedia, undefined, {
            caption: '🔄 Animated sticker → MP4',
        });
        cleanupFiles(inputPath, outputPath);
        await react(msg, '✅');
    } catch (e) {
        logger.error('VSticker Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!vsticker', desc: 'Convert animated sticker ke MP4', isPublic: true }],
};
