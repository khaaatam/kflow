/* global Buffer */
const sharp = require('sharp');
const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg) => {
    if (!msg.hasMentions || msg.mentionedIds.length < 2) {
        return msg.reply('Tag 2 orang!\nContoh: `!ship @user1 @user2`');
    }

    await react(msg, '💕');

    try {
        const user1 = msg.mentionedIds[0];
        const user2 = msg.mentionedIds[1];

        // Generate deterministic "random" percentage
        const hash = (user1 + user2).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const percentage = (hash % 101);

        let verdict;
        if (percentage > 80) verdict = '💕 Perfect Match!';
        else if (percentage > 60) verdict = '😍 Great Chemistry!';
        else if (percentage > 40) verdict = '😏 Could Work';
        else if (percentage > 20) verdict = '🤔 Just Friends';
        else verdict = '💀 Better Apart';

        const hearts = Math.ceil(percentage / 20);
        const heartStr = '❤️'.repeat(hearts) + '🤍'.repeat(5 - hearts);

        const w = 512;
        const h = 512;
        const svg = `<svg width="${w}" height="${h}">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#ee5a24;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="${w}" height="${h}" fill="url(#bg)"/>
            <text x="50%" y="30%" text-anchor="middle" font-family="Impact, Arial, sans-serif" font-size="100" fill="white">💘</text>
            <text x="50%" y="50%" text-anchor="middle" font-family="Impact, Arial, sans-serif" font-size="80" fill="white" paint-order="stroke" stroke="black" stroke-width="3">${percentage}%</text>
            <text x="50%" y="65%" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="white">${verdict}</text>
            <text x="50%" y="80%" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="white">${heartStr}</text>
        </svg>`;

        const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        const media = new MessageMedia('image/png', pngBuffer.toString('base64'));

        await msg.reply(media, undefined, {
            caption: `💕 *SHIP CALCULATOR*\n\n${verdict}\nMatch: ${percentage}%`,
        });
        await react(msg, '✅');
    } catch (e) {
        logger.error('Ship Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!ship', desc: 'Ship calculator (tag 2 orang)', isPublic: true }],
};
