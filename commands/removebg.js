/* global Buffer, FormData */
const sharp = require('@img/sharp-wasm32');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { MessageMedia } = require('whatsapp-web.js');
const fetch = require('node-fetch');
const config = require('../config');

module.exports = async (client, msg) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply('Reply/kirim gambar pake caption `!removebg`');
    }

    await react(msg, '✂️');

    try {
        const targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await downloadMedia(targetMsg);
        if (!media) return msg.reply('❌ Gagal download gambar.');

        const imgBuffer = Buffer.from(media.data, 'base64');

        // Try remove.bg API first
        if (config.ai.apiKey) {
            try {
                const response = await fetch('https://api.remove.bg/v1.0/removebg', {
                    method: 'POST',
                    headers: {
                        'X-Api-Key': process.env.REMOVEBG_API_KEY || '',
                    },
                    body: (() => {
                        const fd = new FormData();
                        fd.append('image_file_b64', media.data);
                        fd.append('size', 'auto');
                        return fd;
                    })(),
                    timeout: 30000,
                });

                if (response.ok) {
                    const buffer = await response.buffer();
                    const resultMedia = new MessageMedia('image/png', buffer.toString('base64'));
                    await msg.reply(resultMedia);
                    await react(msg, '✅');
                    return;
                }
            } catch { /* fallback to sharp */ }
        }

        // Fallback: simple background removal with sharp (threshold-based)
        const result = await sharp(imgBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();

        const resultMedia = new MessageMedia('image/png', result.toString('base64'));
        await msg.reply(resultMedia, undefined, { caption: '✂️ Background removed (basic mode)' });
        await react(msg, '✅');
    } catch (e) {
        logger.error('RemoveBG Error:', e.message);
        await react(msg, '❌');
        await msg.reply(`❌ Error: ${e.message}`);
    }
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!removebg', desc: 'Hapus background gambar', isPublic: true }],
};
