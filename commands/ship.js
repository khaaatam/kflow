const { Jimp } = require('jimp');
const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');

module.exports = async (client, msg) => {
    if (!msg.hasMentions || msg.mentionedIds.length < 2) {
        return msg.reply('Tag 2 orang!\nContoh: `!ship @user1 @user2`');
    }

    await react(msg, '💕');

    try {
        const user1 = msg.mentionedIds[0];
        const user2 = msg.mentionedIds[1];

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

        const img = new Jimp({ width: w, height: h, color: 0xff6b6bff });
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        img.print(font, 0, Math.floor(h * 0.35), { text: `${percentage}%`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER });

        const verdictFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        img.print(verdictFont, 0, Math.floor(h * 0.6), { text: verdict, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER });

        const heartFont = await Jimp.loadFont(Jimp.FONT_SANS_28_WHITE);
        img.print(heartFont, 0, Math.floor(h * 0.75), { text: heartStr, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER });

        const outputPath = tempPath('ship_out', 'png');
        await img.write(outputPath);
        const media = MessageMedia.fromFilePath(outputPath);

        await msg.reply(media, undefined, {
            caption: `💕 *SHIP CALCULATOR*\n\n${verdict}\nMatch: ${percentage}%`,
        });
        cleanupFiles(outputPath);
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
