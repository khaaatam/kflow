const logger = require('../lib/logger');
const react = require('../lib/react');
const { escapeXml, getFontFiles } = require('../lib/mediaEffects');

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
        const maxCharsPerLine = 3;

        const lines = [];
        let cur = [];
        for (const word of words) {
            cur.push(word);
            if (cur.length >= maxCharsPerLine) { lines.push(cur); cur = []; }
        }
        if (cur.length) lines.push(cur);

        const h = padding * 2 + lines.length * lineH;
        const textEls = [];

        for (let li = 0; li < lines.length; li++) {
            const lw = lines[li];
            const y = padding + fontSize + li * lineH;

            const placed = [];
            for (const word of lw) {
                const wordW = word.length * fontSize * 0.45;
                let x;
                let tries = 0;
                do {
                    x = padding + Math.random() * (w - padding * 2 - wordW);
                    tries++;
                } while (tries < 50 && placed.some(p => Math.abs(p.x - x) < (p.w + wordW) / 2 + 5));
                placed.push({ x, w: wordW, word });
            }

            for (const p of placed) {
                const yOff = Math.floor(Math.random() * 6 - 3);
                textEls.push(`<text x="${Math.floor(p.x)}" y="${Math.floor(y + yOff)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="black" font-weight="bold">${escapeXml(p.word)}</text>`);
            }
        }

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
            <rect width="${w}" height="${h}" fill="white"/>
            ${textEls.join('\n')}
        </svg>`;

        const { Resvg } = require('@resvg/resvg-js');
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
