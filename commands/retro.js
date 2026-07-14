const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply("❌ Kirim/Reply foto pake caption `!retro`");
    }

    await msg.react('📸');

    try {
        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await targetMsg.downloadMedia();

        if (!media.mimetype.includes('image')) return msg.reply("❌ Khusus Foto Bang! Kalau video pake !pixel");

        // 1. SETUP FOLDER TEMP
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `in_${timestamp}.jpg`);
        const outputPath = path.join(tempDir, `out_${timestamp}.jpg`);

        // Simpan file sementara
        fs.writeFileSync(inputPath, media.data, 'base64');

        // 2. CEK DIMENSI FOTO DULU (SMART DETECT)
        ffmpeg.ffprobe(inputPath, async (err, metadata) => {
            if (err) {
                logger.error("Probe Error:", err);
                return msg.reply("❌ Gagal baca dimensi gambar.");
            }

            const width = metadata.streams[0].width;
            const height = metadata.streams[0].height;
            const isPortrait = height > width;

            // TENTUKAN TARGET RESOLUSI (Sesuai Layar Nokia X2-01)
            // Landscape: 320x240 (4:3)
            // Portrait: 240x320 (3:4)
            const targetW = isPortrait ? 240 : 320;
            const targetH = isPortrait ? 320 : 240;

            logger.debug(`Input: ${width}x${height} | Mode: ${isPortrait ? 'Portrait' : 'Landscape'} | Target: ${targetW}x${targetH}`);

            // 3. PROSES FFMPEG (AUTO CROP + RETRO)
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions([
                        '-vf',

                        `scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},eq=saturation=0.5:contrast=1.2:gamma_g=1.1:gamma_b=0.9,scale=1080:-1:flags=neighbor`,

                        '-q:v 15' // Turunin kualitas JPG
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
            try { fs.unlinkSync(inputPath); fs.unlinkSync(outputPath); } catch (e) { /* cleanup best-effort */ }
            await msg.react('✅');
        });

    } catch (error) {
        logger.error("Retro Error:", error);
        msg.reply(`❌ Gagal render: ${error.message}`);
    }
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [{ command: '!retro', desc: 'Efek Foto Jadul', isPublic: true }]
};