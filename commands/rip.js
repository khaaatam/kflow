const Jimp = require('jimp');
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
        const w = 512;
        const h = 512;
        const img = new Jimp(w, h, 0x2c2c2cff);

        const bgFont = await Jimp.loadFont(Jimp.FONT_SERIF_42_WHITE);
        img.print(bgFont, 0, h * 0.1, { text: 'R.I.P', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, w);

        const nameFont = await Jimp.loadFont(Jimp.FONT_SERIF_36_WHITE);
        img.print(nameFont, 0, h * 0.4, { text: targetName, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, w);

        const yearFont = await Jimp.loadFont(Jimp.FONT_SERIF_24_GRAY);
        img.print(yearFont, 0, h * 0.55, { text: `${year1} — ${year2}`, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, w);

        const smallFont = await Jimp.loadFont(Jimp.FONT_SERIF_20_DARK_GRAY);
        img.print(smallFont, 0, h * 0.75, { text: 'Rest In Peace', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, w);

        const outputPath = require('path').join(__dirname, '..', 'temp', `rip_${Date.now()}.png`);
        await img.writeAsync(outputPath);
        const media = MessageMedia.fromFilePath(outputPath);

        await msg.reply(media, undefined, { caption: `💀 R.I.P ${targetName}` });
        require('fs').unlinkSync(outputPath);
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
