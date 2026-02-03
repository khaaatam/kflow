const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    const isMedia = msg.hasMedia;
    const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

    if (!isMedia && !isQuotedMedia) {
        return msg.reply("❌ Kirim/Reply foto pake caption `!retro`");
    }

    await msg.react('📸'); // React Kamera

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

        // 2. PROSES FFMPEG (IMAGE CRUNCHER)
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    // LOGIKA BURIK:
                    // 1. scale=176:-1 -> Kecilin paksa ke lebar 176px (Resolusi QCIF Nokia)
                    // 2. scale=1080:-1:flags=neighbor -> Gedein lagi biar tajem kotak-kotaknya
                    '-vf scale=320:-1,scale=1080:-1',

                    // EFEK TAMBAHAN:
                    '-q:v 15' // Kualitas JPG diturunin (Range 2-31, makin gede makin burik). 15 udah pas "buluk"nya.
                ])
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        // 3. KIRIM HASIL
        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(msg.from, processedMedia, {
            caption: '📸 Nokia X2-01 Mode (Image)',
            sendMediaAsDocument: false
        });

        // 4. BERSIH-BERSIH
        try {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        } catch (e) { }

        await msg.react('✅');

    } catch (error) {
        console.error("Retro Error:", error);
        msg.reply(`❌ Gagal render: ${error.message}`);
    }
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [{ command: '!retro', desc: 'Efek Foto Nokia Jadul' }]
};