const logger = require('../lib/logger');
const react = require('../lib/react');
const { svgToSticker } = require('../lib/mediaEffects');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!brat halo dunia`');

    await react(msg, '🎨');
    try {
        const { escapeXml } = require('../lib/mediaEffects');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
            <rect width="512" height="512" fill="#8ACE00"/>
            <text x="256" y="280" text-anchor="middle" font-family="Impact, Arial, sans-serif" font-size="80" fill="black">${escapeXml(text)}</text>
        </svg>`;
        const webpBuf = await svgToSticker(svg);
        const media = new MessageMedia('image/webp', webpBuf.toString('base64'));
        await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'K-Flow Bot', stickerName: 'Brat' });
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
