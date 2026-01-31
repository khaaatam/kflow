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

    await msg.react('🍳');

    try {
        let targetMsg = isMedia ? msg : await msg.getQuotedMessage();
        const media = await targetMsg.downloadMedia();

        if (!media.mimetype.includes('video')) return msg.reply("❌ Khusus Video Bang!");

        // 1. SETUP FOLDER TEMP (MANUAL CREATE BIAR GAK ERROR ENOENT)
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true }); // 🔥 Bikin folder kalo belom ada
        }

        const timestamp = Date.now();
        const inputPath = path.join(tempDir, `in_${timestamp}.mp4`);
        const outputPath = path.join(tempDir, `out_${timestamp}.mp4`);

        // Simpan file sementara
        fs.writeFileSync(inputPath, media.data, 'base64');

        // 2. PROSES FFMPEG (HANCURKAN KUALITAS!)
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .videoFilters(['scale=180:-2', 'fps=fps=10']) // Makin burik (180p, 10fps)
                .outputOptions([
                    '-c:v libx264', '-preset ultrafast',
                    '-b:v 50k',     // Bitrate 50k (Hancur parah)
                    '-pix_fmt yuv420p',
                    '-c:a aac', '-ac 1', '-ar 8000', '-b:a 8k' // Audio kayak radio rusak
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });

        // 3. KIRIM HASIL
        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(msg.from, processedMedia, {
            caption: 'Nih vibes HP Esia Hidayah! 📹',
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
    commands: [{ command: '!pixel', desc: 'Video -> Burik (HD)' }]
};