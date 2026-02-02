const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply("❌ Kirim/Reply video pake caption `!pixel`");
    }

    await msg.react('👾'); // React Pixel

    try {
        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await targetMsg.downloadMedia();

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

        // 2. PROSES FFMPEG (RETRO PIXEL STYLE)
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                // Filter Sakti: Kecilin ke 240p -> Gedein lagi ke 720p pake 'neighbor' (Biar kotak-kotak tajam)
                .videoFilters([
                    'scale=240:-2',             // Kecilin (Sumber Pixel)
                    'scale=720:-2:flags=neighbor', // Gedein lagi (Biar tajem di HP)
                    'fps=fps=20'                // FPS Retro (Agak patah dikit biar vibes)
                ])
                .outputOptions([
                    '-c:v libx264', '-preset ultrafast',
                    '-b:v 1000k',    // Bitrate 1000k (Biar gak pecah compress)
                    '-pix_fmt yuv420p',
                    '-c:a aac', '-b:a 128k' // Audio Normal (Gak kresek-kresek)
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });

        // 3. KIRIM HASIL
        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(msg.from, processedMedia, {
            caption: '👾 Vibes Gameboy Advance! (Retro Style)',
            sendMediaAsDocument: false
        });

        // 4. BERSIH-BERSIH
        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (e) { }

        await msg.react('✅');

    } catch (error) {
        console.error("Pixel Error:", error);
        msg.reply(`❌ Gagal render: ${error.message}`);
    }
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [{ command: '!pixel', desc: 'Efek Video Pixel Art' }]
};
