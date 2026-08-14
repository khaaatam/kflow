/* global Buffer */
const sharp = require('@img/sharp-wasm32');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { escapeXml } = require('../lib/mediaEffects');
const { MessageMedia } = require('whatsapp-web.js');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');
const fs = require('fs');

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
            const buf = await sharp({
                create: { width: 512, height: 512, channels: 4, background: { r: 50, g: 50, b: 50, alpha: 1 } }
            }).jpeg().toBuffer();
            fs.writeFileSync(inputPath, buf);
        }

        const metadata = await sharp(inputPath).metadata();
        const w = metadata.width || 512;
        const h = metadata.height || 512;
        const fontSize = Math.max(24, Math.floor(w / 15));

        let svgOverlay = `<svg width="${w}" height="${h}">`;
        svgOverlay += `<style>text { font-family: Impact, Arial, sans-serif; font-size: ${fontSize}px; fill: white; text-anchor: middle; paint-order: stroke; stroke: black; stroke-width: 3px; }</style>`;

        if (topText) {
            svgOverlay += `<text x="50%" y="${fontSize + 10}">${escapeXml(topText.toUpperCase())}</text>`;
        }
        if (bottomText) {
            svgOverlay += `<text x="50%" y="${h - 10}">${escapeXml(bottomText.toUpperCase())}</text>`;
        }
        svgOverlay += '</svg>';

        const outputPath = tempPath('meme_out', 'png');
        await sharp(inputPath)
            .composite([{ input: Buffer.from(svgOverlay) }])
            .png()
            .toFile(outputPath);

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

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!meme', desc: 'Buat meme (atas;bawah)', isPublic: true }],
};
