/* global Buffer */
const Jimp = require('jimp');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { MessageMedia } = require('whatsapp-web.js');

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

        const imgBuffer = Buffer.from(media.data, 'base64');
        const img = await Jimp.read(imgBuffer);
        const pngBuffer = await img.getBufferAsync(Jimp.MIME_PNG);
        const resultMedia = new MessageMedia('image/png', pngBuffer.toString('base64'));

        await msg.reply(resultMedia, undefined, { caption: '🖼️ Converted from sticker' });
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
