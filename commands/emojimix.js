const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');
const fetch = require('node-fetch');

module.exports = async (client, msg, args) => {
    const input = args.slice(1).join(' ').trim();
    const parts = input.split('+').map(e => e.trim());

    if (parts.length < 2 || !parts[0] || !parts[1]) {
        return msg.reply('Gabung 2 emoji!\nContoh: `!emojimix 😀+😂`');
    }

    await react(msg, '🎭');

    try {
        const emoji1 = parts[0];
        const emoji2 = parts[1];

        // Google Emoji Kitchen v2 API
        const url = `https://fonts.google.com/m8/2/data/emoji?emoji=${encodeURIComponent(emoji1)}&emoji=${encodeURIComponent(emoji2)}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
            timeout: 15000,
        });

        if (!response.ok) {
            // Fallback: try the old API format
            const fallbackUrl = `https://www.google.com/m8/2/data/emoji?emoji=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`;
            const fallbackResp = await fetch(fallbackUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000,
            });
            if (!fallbackResp.ok) throw new Error('Emoji Kitchen API unavailable');
            const data = await fallbackResp.json();
            const imgUrl = data?.images_with_url?.[0]?.url || data?.image_url;
            if (!imgUrl) return msg.reply('❌ Emoji combo gak ditemukan.');
            const media = await MessageMedia.fromUrl(imgUrl, { unsafeMime: true });
            await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'K-Flow Bot', stickerName: 'Emoji Mix' });
            await react(msg, '✅');
            return;
        }

        const data = await response.json();
        const imgUrl = data?.images_with_url?.[0]?.url || data?.image_url;

        if (!imgUrl) return msg.reply('❌ Emoji combo gak ditemukan.');

        const media = await MessageMedia.fromUrl(imgUrl, { unsafeMime: true });
        await msg.reply(media, undefined, {
            sendMediaAsSticker: true,
            stickerAuthor: 'K-Flow Bot',
            stickerName: 'Emoji Mix',
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('EmojiMix Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Emoji combo gak tersedia saat ini.`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!emojimix', desc: 'Gabung 2 emoji (emoji1+emoji2)', isPublic: true }],
};
