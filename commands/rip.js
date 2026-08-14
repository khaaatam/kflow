const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args) => {
    let targetName;
    const year1 = args[2] || '2024';
    const year2 = args[3] || '2024';

    if (msg.hasMentions) {
        const mentionedId = msg.mentionedIds[0];
        const contact = await msg.getContact(mentionedId);
        targetName = contact.pushname || contact.name || mentionedId.split('@')[0];
    } else if (args[1]) {
        targetName = args[1];
    } else {
        return msg.reply('Contoh: `!rip @user [tahun lahir] [tahun meninggal]`');
    }

    await react(msg, '💀');
    try {
        const { svgToPng } = require('../lib/mediaEffects');
        const { escapeXml } = require('../lib/mediaEffects');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#2c2c2c"/>
                    <stop offset="100%" style="stop-color:#1a1a1a"/>
                </linearGradient>
            </defs>
            <rect width="512" height="512" fill="url(#bg)"/>
            <text x="256" y="77" text-anchor="middle" font-family="serif" font-size="40" fill="white">R.I.P</text>
            <text x="256" y="230" text-anchor="middle" font-family="serif" font-size="36" fill="white" font-style="italic">${escapeXml(targetName)}</text>
            <text x="256" y="307" text-anchor="middle" font-family="serif" font-size="24" fill="#aaa">${year1} — ${year2}</text>
            <text x="256" y="410" text-anchor="middle" font-family="serif" font-size="20" fill="#666">Rest In Peace</text>
            <line x1="100" y1="358" x2="412" y2="358" stroke="#555" stroke-width="2"/>
        </svg>`;
        const pngBuf = svgToPng(svg);
        const media = new MessageMedia('image/png', pngBuf.toString('base64'));
        await msg.reply(media, undefined, { caption: `💀 R.I.P ${targetName}` });
        await react(msg, '✅');
    } catch (e) {
        logger.error('RIP Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!rip', desc: 'RIP meme (tag/nama [tahun1] [tahun2])', isPublic: true }],
};
