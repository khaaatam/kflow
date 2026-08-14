const config = require('../config');
const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');
const fetch = require('node-fetch');

const IMAGE_URL = `${config.ai.routerUrl}/models/image`;

async function generateImage(prompt) {
    if (!config.ai.apiKey) return null;

    try {
        const response = await fetch(IMAGE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.ai.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                n: 1,
                size: '1024x1024',
            }),
            timeout: 60000,
        });

        if (!response.ok) {
            const errText = await response.text();
            logger.error(`Image Gen Error (${response.status}): ${errText.slice(0, 200)}`);
            return null;
        }

        const data = await response.json();

        if (data.data && data.data[0]) {
            const item = data.data[0];
            if (item.b64_json) {
                return MessageMedia.fromFilePath({ data: item.b64_json, mimetype: 'image/png', filename: 'generated.png' });
            }
            if (item.url) {
                return MessageMedia.fromUrl(item.url, { unsafeMime: true });
            }
        }

        return null;
    } catch (e) {
        logger.error('Image Gen Error:', e.message);
        return null;
    }
}

module.exports = async (client, msg, args) => {
    const prompt = args.slice(1).join(' ').trim();
    if (!prompt) {
        return msg.reply('Mau gambar apa?\nContoh: `!gambar kucing lucu pakai topi`');
    }

    await react(msg, '🎨');

    try {
        const media = await generateImage(prompt);
        if (!media) {
            await react(msg, '❌');
            return msg.reply('❌ Gagal generate gambar. Coba lagi nanti.');
        }

        await msg.reply(media, undefined, {
            caption: `🎨 *${prompt}*`,
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('Gambar Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!gambar', desc: 'Generate gambar dari teks (AI Image)', isPublic: false }],
};
