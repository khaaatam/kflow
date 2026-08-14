/* global Buffer */
const fs = require('fs');
const { Jimp } = require('jimp');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { MessageMedia } = require('whatsapp-web.js');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');
const { svgToPng, escapeXml } = require('../lib/mediaEffects');

module.exports = async (client, msg, args) => {
    const input = args.slice(1).join(' ');
    const parts = input.split(';').map(s => s.trim());
    const topText = parts[0] || '';
    const bottomText = parts[1] || '';

    if (!topText) return msg.reply('Contoh: `!meme teks atas;teks bawah` (kirim/reply gambar)');

    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    try {
        await react(msg, '🎭');

        let img;
        if (isMedia || isQuotedMedia) {
            const targetMsg = isMedia ? msg : await msg.getQuotedMessage();
            const media = await downloadMedia(targetMsg);
            if (!media) return msg.reply('❌ Gagal download gambar.');
            const inputPath = tempPath('meme_in', 'jpg');
            fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));
            img = await Jimp.read(inputPath);
            cleanupFiles(inputPath);
        } else {
            img = new Jimp({ width: 512, height: 512, color: 0x323232FF });
        }

        const w = img.bitmap.width;
        const h = img.bitmap.height;
        const fontSize = Math.max(24, Math.floor(w / 15));

        let svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
        if (topText) {
            svgOverlay += `<text x="${w/2}" y="${fontSize + 10}" text-anchor="middle" font-family="Impact, Arial, sans-serif" font-size="${fontSize}" fill="white" paint-order="stroke" stroke="black" stroke-width="3">${escapeXml(topText.toUpperCase())}</text>`;
        }
        if (bottomText) {
            svgOverlay += `<text x="${w/2}" y="${h - 10}" text-anchor="middle" font-family="Impact, Arial, sans-serif" font-size="${fontSize}" fill="white" paint-order="stroke" stroke="black" stroke-width="3">${escapeXml(bottomText.toUpperCase())}</text>`;
        }
        svgOverlay += '</svg>';

        const overlayPng = svgToPng(svgOverlay);
        const overlayImg = await Jimp.read(overlayPng);
        img.composite(overlayImg, 0, 0);

        const outputPath = tempPath('meme_out', 'png');
        await img.write(outputPath);
        const resultMedia = MessageMedia.fromFilePath(outputPath);
        await msg.reply(resultMedia);
        cleanupFiles(outputPath);
        await react(msg, '✅');
    } catch (e) {
        logger.error('Meme Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!meme', desc: 'Buat meme (atas;bawah)', isPublic: true }],
};
