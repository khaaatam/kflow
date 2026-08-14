const logger = require('../lib/logger');
const react = require('../lib/react');
const { escapeXml } = require('../lib/mediaEffects');

module.exports = async (client, msg, args) => {
    const text = args.slice(1).join(' ').trim();
    if (!text) return msg.reply('Mau nulis apa?\nContoh: `!brat halo dunia`');

    await react(msg, '🎨');
    try {
        const words = text.split(' ');
        const lineH = 52;
        const padding = 20;
        const w = 350;
        const fontSize = 34;

        const lines = [];
        let cur = [];
        for (const word of words) {
            cur.push(word);
            if (cur.length >= 3 || cur.join(' ').length > 18) {
                lines.push(cur);
                cur = [];
            }
        }
        if (cur.length) lines.push(cur);

        const h = padding * 2 + lines.length * lineH;

        const textEls = [];
        for (let li = 0; li < lines.length; li++) {
            const lineWords = lines[li];
            const y = padding + fontSize + li * lineH;
            const gap = (w - 40) / (lineWords.length + 1);
            for (let wi = 0; wi < lineWords.length; wi++) {
                const x = 20 + gap * (wi + 1) + (Math.random() * 10 - 5);
                textEls.push(`<text x="${Math.floor(x)}" y="${Math.floor(y + (Math.random() * 6 - 3))}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="black" font-weight="bold">${escapeXml(lineWords[wi])}</text>`);
            }
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
            <rect width="${w}" height="${h}" fill="white"/>
            ${textEls.join('\n')}
        </svg>`;

        const { Resvg } = require('@resvg/resvg-js');
        const { getFontFiles } = require('../lib/mediaEffects');
        const resvg = new Resvg(svg, {
            font: { loadSystemFonts: false, fontFiles: getFontFiles(), defaultFontFamily: 'Arial' },
            fitTo: { mode: 'width', value: Math.floor(w / 2) }
        });
        const pngBuf = resvg.render().asPng();

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
