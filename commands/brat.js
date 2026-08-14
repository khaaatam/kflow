const logger = require('../lib/logger');
const react = require('../lib/react');
const { textToSticker } = require('../lib/mediaEffects');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!brat halo dunia`');

    await react(msg, '🎨');

    try {
        const webpBuffer = await textToSticker(text, {
            bgColor: '#8ACE00',
            textColor: 'black',
            fontSize: 80,
            width: 512,
            height: 512,
        });

        const media = new MessageMedia('image/webp', webpBuffer.toString('base64'));
        await msg.reply(media, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'K-Flow Bot',
            stickerName: 'Brat',
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('Brat Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!brat', desc: 'Brat-style lime green text sticker', isPublic: true }],
};
