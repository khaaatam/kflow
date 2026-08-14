const logger = require('../lib/logger');
const react = require('../lib/react');
const { svgToPng, escapeXml } = require('../lib/mediaEffects');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!brat halo dunia`');

    await react(msg, '🎨');
    try {
        const words = text.split(' ');
        const lineH = 50;
        const padding = 30;
        const w = 400;
        const fontSize = 36;
        const h = padding * 2 + Math.ceil(words.length / 3) * lineH + 10;

        const textEls = [];
        for (let i = 0; i < words.length; i++) {
            const lineIdx = Math.floor(i / 3);
            const y = padding + fontSize + lineIdx * lineH + (Math.random() * 10 - 5);
            const x = 20 + Math.random() * (w - 60);
            textEls.push(`<text x="${Math.floor(x)}" y="${Math.floor(y)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="black" font-weight="bold">${escapeXml(words[i])}</text>`);
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
            <rect width="${w}" height="${h}" fill="white"/>
            ${textEls.join('\n')}
        </svg>`;

        const pngBuf = svgToPng(svg);
        const img = await require('jimp').Jimp.read(pngBuf);
        const webpBuf = await require('../lib/mediaEffects').imgToWebp(img);

        const { MessageMedia } = require('whatsapp-web.js');
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
    commands: [{ command: '!brat', desc: 'Brat-style text sticker', isPublic: true }],
};
