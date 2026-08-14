const logger = require('../lib/logger');
const react = require('../lib/react');
const { textToSticker } = require('../lib/mediaEffects');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!attp halo dunia`');

    await react(msg, '🌈');

    try {
        const webpBuffer = await textToSticker(text, {
            bgColor: 'transparent',
            textColor: 'white',
            fontSize: 60,
            width: 512,
            height: 512,
        });

        const media = new MessageMedia('image/webp', webpBuffer.toString('base64'));
        await msg.reply(media, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'K-Flow Bot',
            stickerName: 'ATTP',
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('ATTP Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!attp', desc: 'Animated text-to-sticker (putih transparan)', isPublic: true }],
};
