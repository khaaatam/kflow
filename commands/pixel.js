const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');

module.exports = async (client, msg, _args, _senderId, _namaPengirim, _text) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply("❌ Kirim/Reply video pake caption `!pixel`");
    }

    await react(msg, '📠'); // React Fax/Jadul

    try {
        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await downloadMedia(targetMsg);

        if (!media.mimetype.includes('video')) return msg.reply("❌ Khusus Video Bang!");

        // 1. SETUP FOLDER TEMP
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `in_${timestamp}.mp4`);
        const outputPath = path.join(tempDir, `out_${timestamp}.mp4`);

        // Simpan file sementara
        fs.writeFileSync(inputPath, media.data, 'base64');

        // 2. PROSES FFMPEG (STYLE NOKIA JADUL)
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .videoFilters([
                    'scale=176:-2',             // Resolusi QCIF (Standar Nokia X2-01 / HP Java)
                    'scale=720:-2:flags=neighbor', // Tetep di-upscale biar pixelnya JELAS & KOTAK di layar modern
                    'fps=fps=12'                // FPS 12 (Patah-patah khas rekaman HP jadul)
                ])
                .outputOptions([
                    '-c:v libx264', '-preset ultrafast',
                    '-b:v 400k',      // Bitrate rendah tapi cukup buat nampilin kotak-kotak
                    '-pix_fmt yuv420p',
                    // 👇 SETTINGAN AUDIO BUSUK (Khas Nokia) 👇
                    '-ar 8000',       // Sample Rate 8kHz (Kualitas Telepon Rumah)
                    '-ac 1',          // Mono (1 Channel)
                    '-c:a aac', '-b:a 24k' // Bitrate Audio Hancur
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });

        // 3. KIRIM HASIL
        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await msg.reply(processedMedia, undefined, {
            caption: '📼 Nokia X2-01 Mode (176p @ 12fps)',
            sendMediaAsDocument: false
        });

        // 4. BERSIH-BERSIH
        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch { /* cleanup best-effort */ }

        await react(msg, '✅');

    } catch (error) {
        logger.error("Pixel Error:", error.message || error);
        logger.error("Pixel Stack:", error.stack);
        msg.reply(`❌ Gagal render: ${error.message || 'Unknown error'}`);
    }
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [{ command: '!pixel', desc: 'Efek Video Nokia Jadul', isPublic: true }]
};
