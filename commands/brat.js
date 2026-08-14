const logger = require('../lib/logger');
const react = require('../lib/react');
const { svgToPng, escapeXml } = require('../lib/mediaEffects');
const { Jimp } = require('jimp');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!brat halo dunia`');

    await react(msg, '🎨');
    try {
        const words = text.split(' ');
        const lines = [];
        let cur = '';
        for (const word of words) {
            if ((cur + ' ' + word).trim().length > 12) { if (cur) lines.push(cur); cur = word; }
            else { cur = (cur + ' ' + word).trim(); }
        }
        if (cur) lines.push(cur);

        const lineH = 42;
        const padding = 30;
        const w = 300;
        const h = padding * 2 + lines.length * lineH + 10;
        const fontSize = 34;

        const textElements = lines.map((line, i) => {
            const y = padding + fontSize + i * lineH;
            return `<text x="${w / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="black" font-weight="bold">${escapeXml(line)}</text>`;
        }).join('\n');

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
            <rect width="${w}" height="${h}" fill="white"/>
            ${textElements}
        </svg>`;

        const pngBuf = svgToPng(svg);
        const img = await Jimp.read(pngBuf);
        const webpBuf = await (require('../lib/mediaEffects')).imgToWebp(img);

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
