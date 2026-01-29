const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    // 1. Cek Media
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply("❌ Kirim/Reply video pake caption `!pixel`");
    }

    await msg.react('🍳'); // Lagi masak...

    try {
        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await targetMsg.downloadMedia();

        if (!media.mimetype.includes('video')) return msg.reply("❌ Khusus Video Bang!");

        // 2. Setup Path
        const timestamp = Date.now();
        // Simpan di temp folder (sesuai kode lama lu)
        const inputPath = path.join(__dirname, `../.wwebjs_cache/temp_in_${timestamp}.mp4`);
        const outputPath = path.join(__dirname, `../.wwebjs_cache/temp_out_${timestamp}.mp4`);

        fs.writeFileSync(inputPath, media.data, 'base64');

        // 3. Proses FFmpeg (Resep Burik)
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .videoFilters(['scale=320:-2', 'fps=fps=15']) // Resolusi kecil & Patah-patah
                .outputOptions([
                    '-c:v libx264', '-preset ultrafast',
                    '-b:v 80k', // Bitrate Video Hancur
                    '-pix_fmt yuv420p',
                    '-c:a aac', '-ac 1', '-ar 8000', '-b:a 12k' // Audio Mendem
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });

        // 4. Kirim Hasil
        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(msg.from, processedMedia, {
            caption: 'Nih vibes Nokia 2005! 📹',
            sendMediaAsDocument: false
        });

        // 5. Bersih-bersih
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        await msg.react('✅');

    } catch (error) {
        console.error(error);
        msg.reply(`❌ Gagal render: ${error.message}`);
    }
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [{ command: '!pixel', desc: 'Video -> Burik (HD)' }]
};