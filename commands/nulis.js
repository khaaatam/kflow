const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');
const { svgToSticker } = require('../lib/mediaEffects');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!nulis halo dunia`');

    await react(msg, '✍️');
    try {
        const { escapeXml } = require('../lib/mediaEffects');
        const lines = [];
        const maxChars = 25;
        const words = text.split(' ');
        let cur = '';
        for (const word of words) {
            if ((cur + ' ' + word).trim().length > maxChars) { if (cur) lines.push(cur); cur = word; }
            else { cur = (cur + ' ' + word).trim(); }
        }
        if (cur) lines.push(cur);

        const w = 512;
        const h = Math.max(400, 200 + lines.length * 45);
        const startY = 150;

        const textElements = lines.map((line, i) => {
            const y = startY + i * 45;
            const xOff = Math.floor(Math.random() * 4) - 2;
            const yOff = Math.floor(Math.random() * 4) - 2;
            return `<text x="${100 + xOff}" y="${y + yOff}" font-family="serif" font-size="28" fill="#333" transform="rotate(${(Math.random() * 2 - 1).toFixed(1)}, ${100}, ${y})">${escapeXml(line)}</text>`;
        }).join('');

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
            <defs>
                <linearGradient id="paper" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#f5f0e1"/>
                    <stop offset="100%" style="stop-color:#e8e0c8"/>
                </linearGradient>
            </defs>
            <rect width="${w}" height="${h}" fill="url(#paper)"/>
            <line x1="80" y1="100" x2="80" y2="${h - 50}" stroke="#ccc" stroke-width="1"/>
            ${textElements}
        </svg>`;

        const webpBuf = await svgToSticker(svg);
        const media = new MessageMedia('image/webp', webpBuf.toString('base64'));
        await msg.reply(media, undefined, {
            caption: '✍️ Nulis di kertas',
            sendMediaAsSticker: true,
            stickerAuthor: 'K-Flow Bot',
            stickerName: 'Nulis',
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('Nulis Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!nulis', desc: 'Tulis tangan di kertas', isPublic: true }],
};
