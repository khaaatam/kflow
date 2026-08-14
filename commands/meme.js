/* global Buffer */
const fs = require('fs');
const { Jimp } = require('jimp');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { MessageMedia } = require('whatsapp-web.js');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');
const { svgToJpg } = require('../lib/mediaEffects');

module.exports = async (client, msg, args) => {
    const input = args.slice(1).join(' ');
    const parts = input.split(';').map(s => s.trim());
    const topText = parts[0] || '';
    const bottomText = parts[1] || '';

    if (!topText) {
        return msg.reply('Contoh: `!meme teks atas;teks bawah` (kirim/reply gambar)');
    }

    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    let inputPath;
    try {
        await react(msg, '🎭');

        if (isMedia || isQuotedMedia) {
            const targetMsg = isMedia ? msg : await msg.getQuotedMessage();
            const media = await downloadMedia(targetMsg);
            if (!media) return msg.reply('❌ Gagal download gambar.');

            const ext = media.mimetype?.includes('png') ? 'png' : 'jpg';
            inputPath = tempPath('meme_in', ext);
            fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));
        } else {
            inputPath = tempPath('meme_in', 'png');
            const img = new Jimp({ width: 512, height: 512, color: 0x323232FF });
            await img.write(inputPath);
        }

        const img = await Jimp.read(inputPath);
        const w = img.bitmap.width;
        const h = img.bitmap.height;
        const fontSize = Math.max(24, Math.floor(w / 15));

        let svgOverlay = `<svg width="${w}" height="${h}">`;
        svgOverlay += `<style>text { font-family: Impact, Arial, sans-serif; font-size: ${fontSize}px; fill: white; text-anchor: middle; paint-order: stroke; stroke: black; stroke-width: 3px; }</style>`;

        if (topText) {
            svgOverlay += `<text x="50%" y="${fontSize + 10}">${escapeXmlLocal(topText.toUpperCase())}</text>`;
        }
        if (bottomText) {
            svgOverlay += `<text x="50%" y="${h - 10}">${escapeXmlLocal(bottomText.toUpperCase())}</text>`;
        }
        svgOverlay += '</svg>';

        const svgBuf = await svgToJpg(svgOverlay);
        const overlayImg = await Jimp.read(svgBuf);
        img.composite(overlayImg, 0, 0);

        const outputPath = tempPath('meme_out', 'png');
        await img.write(outputPath);

        const resultMedia = MessageMedia.fromFilePath(outputPath);
        await msg.reply(resultMedia);
        cleanupFiles(inputPath, outputPath);
        await react(msg, '✅');
    } catch (e) {
        logger.error('Meme Error:', e.message);
        if (inputPath) cleanupFiles(inputPath);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

function escapeXmlLocal(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!meme', desc: 'Buat meme (atas;bawah)', isPublic: true }],
};
