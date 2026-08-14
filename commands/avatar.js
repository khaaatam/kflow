const sharp = require('@img/sharp-wasm32');
const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');
const fetch = require('node-fetch');

module.exports = async (client, msg) => {
    await react(msg, '👤');

    try {
        const seed = Math.random().toString(36).substring(7);
        const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;

        const response = await fetch(url, { timeout: 10000 });
        if (!response.ok) throw new Error('DiceBear API unavailable');

        const svgBuffer = await response.buffer();
        const pngBuffer = await sharp(svgBuffer).png().toBuffer();

        const media = new MessageMedia('image/png', pngBuffer.toString('base64'));
        await msg.reply(media, undefined, {
            caption: `👤 Random Avatar (${seed})`,
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('Avatar Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!avatar', desc: 'Random avatar image', isPublic: true }],
};
