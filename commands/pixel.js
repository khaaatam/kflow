const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    if (text.toLowerCase() !== '!pixel') return false;

    try {
        const isMedia = msg.hasMedia;
        const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

        if (!isMedia && !isQuotedMedia) {
            await msg.reply("❌ Kirim/Reply video pake caption *!pixel*");
            return true;
        }

        await msg.react('🍳');

        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await targetMsg.downloadMedia();

        if (!media || !media.mimetype.includes('video')) {
            return msg.reply("❌ Format salah! Kirim video ya bang.");
        }

        const timestamp = new Date().getTime();
        const inputPath = path.join(__dirname, `../.wwebjs_cache/temp_in_${timestamp}.mp4`);
        const outputPath = path.join(__dirname, `../.wwebjs_cache/temp_out_${timestamp}.mp4`);

        fs.writeFileSync(inputPath, media.data, 'base64');

        // --- SETTINGAN PIXEL ---
        const pixelFactor = 25;

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .videoFilters([
                    // Downscale: Pake -2 biar dimensi tetep genap
                    `scale=iw/${pixelFactor}:-2`,
                    // Upscale: Pake -2 lagi biar output final genap (Wajib buat libx264)
                    `scale=iw*${pixelFactor}:-2:flags=neighbor`
                ])
                .outputOptions([
                    '-c:v libx264',      // Codec video standar
                    '-preset ultrafast', // Biar cepet render di HP
                    '-pix_fmt yuv420p',  // WAJIB: Biar warna compatible sama WA/Android
                    '-c:a copy'          // Audio gak usah diotak-atik (biar cepet)
                ])
                // 👇 DEBUG: Biar ketahuan kalo error kenapa
                .on('stderr', function (stderrLine) {
                    // console.log('FFmpeg Log: ' + stderrLine); // Uncomment kalo mau liat log
                })
                .on('end', resolve)
                .on('error', (err) => {
                    console.error('FFmpeg Error Detail:', err); // Bakal muncul di console
                    reject(err);
                })
                .save(outputPath);
        });

        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(msg.from, processedMedia, {
            caption: 'Nih hasil pixelated-nya! 👾',
            sendMediaAsDocument: false
        });

        await msg.react('✅');

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (error) {
        // Tampilkan pesan error yang lebih detail ke console biar gampang debug
        console.error("Gagal Pixelate:", error.message);
        await msg.reply(`❌ Gagal render: ${error.message}`);
    }
    return true;
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [
        { command: '!pixel', desc: 'Ubah video jadi pixelated/8-bit' }
    ]
};