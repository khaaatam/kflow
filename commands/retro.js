const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');

module.exports = async (client, msg, _args, _senderId, _namaPengirim, _text) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply("❌ Kirim/Reply foto pake caption `!retro`");
    }

    await react(msg, '📸');

    try {
        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await downloadMedia(targetMsg);
        if (!media) return msg.reply("❌ Gagal download media.");

        logger.debug(`Retro: msg.type=${targetMsg.type}, mimetype=${media.mimetype}`);
        const isImage = targetMsg.type === 'image' || (media.mimetype && media.mimetype.includes('image'));
        if (!isImage) return msg.reply("❌ Khusus Foto Bang! Kalau video pake !pixel");

        const inputPath = tempPath('retro_in', 'jpg');
        const outputPath = tempPath('retro_out', 'jpg');

        // Simpan file sementara
        fs.writeFileSync(inputPath, media.data, 'base64');

        // 2. CEK DIMENSI FOTO DULU (SMART DETECT)
        ffmpeg.ffprobe(inputPath, async (err, metadata) => {
            if (err) {
                logger.error("Probe Error:", err);
                cleanupFiles(inputPath);
                return msg.reply("❌ Gagal baca dimensi gambar.");
            }

            try {
                const stream = metadata.streams.find(s => s.width && s.height) || metadata.streams[0];
                if (!stream || !stream.width || !stream.height) {
                    cleanupFiles(inputPath);
                    return msg.reply("❌ Gagal baca dimensi gambar.");
                }

                const width = stream.width;
                const height = stream.height;
                const isPortrait = height > width;

                // TENTUKAN TARGET RESOLUSI (Sesuai Layar Nokia X2-01)
                const targetW = isPortrait ? 240 : 320;
                const targetH = isPortrait ? 320 : 240;

                logger.debug(`Input: ${width}x${height} | Mode: ${isPortrait ? 'Portrait' : 'Landscape'} | Target: ${targetW}x${targetH}`);

                // 3. PROSES FFMPEG (AUTO CROP + RETRO)
                await new Promise((resolve, reject) => {
                    ffmpeg(inputPath)
                        .outputOptions([
                            '-vf',
                            `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},eq=saturation=0.5:contrast=1.2:gamma_g=1.1:gamma_b=0.9,scale=1080:-1:flags=neighbor`,
                            '-q:v 15'
                        ])
                        .save(outputPath)
                        .on('end', resolve)
                        .on('error', reject);
                });

                // 4. KIRIM HASIL
                const processedMedia = MessageMedia.fromFilePath(outputPath);
                await msg.reply(processedMedia, undefined, {
                    caption: `📸 Retrorized\n📟 ${isPortrait ? 'Portrait (240x320)' : 'Landscape (320x240)'}`,
                    sendMediaAsDocument: false
                });

                // 5. BERSIH-BERSIH
                cleanupFiles(inputPath, outputPath);
                await react(msg, '✅');
            } catch (e) {
                logger.error("Retro Process Error:", e);
                cleanupFiles(inputPath);
                await msg.reply("❌ Gagal render retro.");
            }
        });

    } catch (error) {
        logger.error("Retro Error:", error.message || error);
        logger.error("Retro Stack:", error.stack);
        await msg.reply(`❌ Gagal render: ${error.message || 'Unknown error'}`);
    }
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [{ command: '!retro', desc: 'Efek Foto Jadul', isPublic: true }]
};