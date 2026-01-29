const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    // Cek trigger
    if (text.toLowerCase() !== '!pixel') return false;

    try {
        // Cek media (langsung atau quoted)
        const isMedia = msg.hasMedia;
        const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

        if (!isMedia && !isQuotedMedia) {
            await msg.reply("❌ Kirim video pake caption *!pixel* atau Reply video orang.");
            return true;
        }

        await msg.react('🍳'); // Reaksi lagi dimasak

        // Tentukan target pesan
        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();

        // Download Media
        const media = await targetMsg.downloadMedia();
        if (!media || !media.mimetype.includes('video')) {
            return msg.reply("❌ Format salah! Kirim video ya bang.");
        }

        // Bikin path file temporary
        const timestamp = new Date().getTime(); // 👈 PERBAIKAN 1: new Date()
        const inputPath = path.join(__dirname, `../.wwebjs_cache/temp_in_${timestamp}.mp4`);
        const outputPath = path.join(__dirname, `../.wwebjs_cache/temp_out_${timestamp}.mp4`);

        // Simpan file sementara
        fs.writeFileSync(inputPath, media.data, 'base64');

        // PROSES FFMPEG (Logic Pixelated)
        // pixelFactor: 20 (makin gede makin kotak2)
        const pixelFactor = 25;

        await new Promise((resolve, reject) => { // 👈 PERBAIKAN 2: new Promise()
            ffmpeg(inputPath)
                .videoFilters([
                    `scale=iw/${pixelFactor}:-1`,             // Kecilin (Downscale)
                    `scale=iw*${pixelFactor}:-1:flags=neighbor` // Gedein lagi (Upscale + Neighbor)
                ])
                .outputOptions('-c:v libx264') // Codec aman buat WA
                .outputOptions('-preset ultrafast') // Biar cepet
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });

        // Kirim hasilnya
        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(msg.from, processedMedia, {
            caption: 'Nih hasil pixelated-nya! 👾',
            sendMediaAsDocument: false
        });

        await msg.react('✅');

        // Bersih-bersih file sampah
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (error) {
        console.error("Pixel Video Error:", error);
        await msg.reply("❌ Gagal render video.");
    }
    return true;
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [
        { command: '!pixel', desc: 'Ubah video jadi pixelated/8-bit' }
    ]
};