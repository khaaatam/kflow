const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    // Cek trigger (Masih pake !pixel gapapa, atau mau ganti !burik juga boleh)
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

        // --- PROSES FFMPEG ALA HP JADUL (3GP VIBES) ---
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                // 1. Filter Video
                .videoFilters([
                    // Set resolusi ke 240p (resolusi umum HP jadul: 320x240)
                    // 'scale=320:-2' artinya lebar 320, tinggi menyesuaikan tapi harus genap (-2)
                    'scale=320:-2',
                    // Set FPS jadi 15 biar agak patah-patah ala kamera VGA
                    'fps=fps=15'
                ])
                // 2. Opsi Output (Ini yang bikin burik)
                .outputOptions([
                    '-c:v libx264',      // Codec standar
                    '-preset ultrafast', // Preset paling cepet (kualitas encode jelek, bagus buat kita)

                    // 🔥 KUNCI KEBURIKAN: Bitrate Video Rendah 🔥
                    // Normalnya 720p itu 2000k++. Kita kasih cuma 150k.
                    // Makin kecil angkanya, makin hancur/kotak-kotak kompresinya.
                    '-b:v 80k',

                    '-pix_fmt yuv420p',  // Wajib buat WA

                    // Opsi Audio (Kita bikin audionya mendam sekalian)
                    '-ac 1',      // Jadi Mono (bukan Stereo)
                    '-ar 22050'   // Sample rate rendah (suara jadi kyk radio butut)
                    // Kalau mau audio aslinya aja, hapus 2 baris di atas, ganti jadi: '-c:a copy'
                ])
                .on('end', resolve)
                .on('error', (err) => {
                    console.error('FFmpeg Error Detail:', err);
                    reject(err);
                })
                .save(outputPath);
        });

        const processedMedia = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(msg.from, processedMedia, {
            caption: 'Nih vibes HP Nokia 2005! 📹',
            sendMediaAsDocument: false
        });

        await msg.react('✅');

        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    } catch (error) {
        console.error("Gagal Pixelate:", error.message);
        await msg.reply(`❌ Gagal render: ${error.message}`);
    }
    return true;
};

module.exports.metadata = {
    category: "MEDIA",
    commands: [
        { command: '!pixel', desc: 'Ubah video jadi burik ala HP jadul' }
    ]
};