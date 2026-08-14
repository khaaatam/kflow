const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');
const fetch = require('node-fetch');

module.exports = async (client, msg, args) => {
    const emojis = args.slice(1).join(' ').split('+').map(e => e.trim());

    if (emojis.length < 2 || !emojis[0] || !emojis[1]) {
        return msg.reply('Gabung 2 emoji!\nContoh: `!emojimix 😀+😂`');
    }

    await react(msg, '🎭');

    try {
        const emoji1 = encodeURIComponent(emojis[0]);
        const emoji2 = encodeURIComponent(emojis[1]);

        // Use Google Emoji Kitchen API
        const url = `https://www.google.com/m8/2/data/emoji?emoji=${emoji1}_${emoji2}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });

        if (!response.ok) throw new Error('Emoji Kitchen API unavailable');

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
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!emojimix', desc: 'Gabung 2 emoji (emoji1+emoji2)', isPublic: true }],
};
