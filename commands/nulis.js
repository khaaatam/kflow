const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');
const { svgToBuffer } = require('../lib/mediaEffects');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!nulis halo dunia`');

    await react(msg, '✍️');

    try {
        const lines = [];
        const maxChars = 25;
        const words = text.split(' ');
        let currentLine = '';

        for (const word of words) {
            if ((currentLine + ' ' + word).trim().length > maxChars) {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = (currentLine + ' ' + word).trim();
            }
        }
        if (currentLine) lines.push(currentLine);

        const w = 512;
        const h = Math.max(400, 200 + lines.length * 45);
        const fontSize = 28;
        const lineHeight = 45;
        const startY = 150;

        const textElements = lines.map((line, i) => {
            const y = startY + i * lineHeight;
            const xOffset = Math.floor(Math.random() * 4) - 2;
            const yOffset = Math.floor(Math.random() * 4) - 2;
            return `<text x="${100 + xOffset}" y="${y + yOffset}" font-family="serif" font-size="${fontSize}" fill="#333" transform="rotate(${Math.random() * 2 - 1}, ${100}, ${y})">${escapeXmlLocal(line)}</text>`;
        }).join('\n');

        const svg = `<svg width="${w}" height="${h}">
            <defs>
                <linearGradient id="paper" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#f5f0e1;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#e8e0c8;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="${w}" height="${h}" fill="url(#paper)"/>
            <line x1="80" y1="100" x2="80" y2="${h - 50}" stroke="#ccc" stroke-width="1"/>
            ${textElements}
        </svg>`;

        const pngBuffer = await svgToBuffer(svg, 'png');
        const media = new MessageMedia('image/png', pngBuffer.toString('base64'));

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

function escapeXmlLocal(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!nulis', desc: 'Tulis tangan di kertas', isPublic: true }],
};
