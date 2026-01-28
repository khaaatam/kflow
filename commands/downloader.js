const config = require('../config');
// Import library lama (buat YT & TikTok)
const { ttdl, youtube } = require('btch-downloader');
// Import library baru (buat FB & IG)
const { ndown, tikdown, ytdown } = require('nayan-media-downloader');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        const url = match[0];

        // --- 1. TIKTOK DOWNLOADER (Dual Engine) ---
        if (url.includes('tiktok.com')) {
            await msg.react('⏳');
            try {
                // Coba engine 1 (btch)
                let data = await ttdl(url);
                let videoUrl = data.url || data.video || data.nowm;
                
                // Kalau engine 1 gagal, coba engine 2 (nayan)
                if (!videoUrl) {
                    console.log("⚠️ Engine 1 gagal, coba Engine 2...");
                    const data2 = await tikdown(url);
                    videoUrl = data2.data?.video || data2.data?.nowm;
                }

                if (!videoUrl) return msg.reply("❌ Gagal download TikTok (Dua engine nyerah).");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `🎵 *TikTok Downloader*`
                });
            } catch (e) {
                console.error(e);
                await msg.reply("❌ Error TikTok.");
            }
            return true;
        }

        // --- 2. INSTAGRAM DOWNLOADER (Pake Nayan - Lebih Stabil) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                const data = await ndown(url);
                if (!data.data || data.data.length === 0) return msg.reply("❌ Gagal/Private Account.");

                // Kirim semua slide (max 5)
                for (let i = 0; i < Math.min(data.data.length, 5); i++) {
                    const mediaUrl = data.data[i].url;
                    await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true }));
                }
            } catch (e) {
                await msg.reply("❌ Gagal IG.");
            }
            return true;
        }

        // --- 3. FACEBOOK DOWNLOADER (WAJIB GANTI INI) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                console.log(`🔍 Mencoba FB Nayan untuk: ${url}`);
                
                // Pake Library Baru (Nayan)
                const data = await ndown(url);
                
                // Debugging (Spy Mode)
                console.log("📦 FB RESULT:", JSON.stringify(data, null, 2));

                if (!data.status || !data.data) return msg.reply("❌ Gagal ambil data FB (Server Down/Private).");

                // Cari video HD atau SD
                // Nayan biasanya ngasih array, kita cari yang .url nya ada mp4
                let videoUrl = null;
                
                // Cek struktur data nayan (biasanya array of objects)
                if (Array.isArray(data.data)) {
                    // Prioritas cari yang HD
                    const hdVideo = data.data.find(v => v.quality === 'HD' || v.url.includes('hd'));
                    const sdVideo = data.data.find(v => v.quality === 'SD' || v.url.includes('sd'));
                    videoUrl = (hdVideo || sdVideo || data.data[0]).url;
                } else {
                    videoUrl = data.data.url;
                }

                if (!videoUrl) return msg.reply("❌ Video tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Downloader*`
                });

            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal download FB.");
            }
            return true;
        }

        // --- 4. YOUTUBE (Tetap BTCH karena stabil) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            try {
                const data = await youtube(url);
                if (!data || !data.mp4) return msg.reply("❌ Gagal YT.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4, { unsafeMime: true }), {
                    caption: `📺 *${data.title}*`
                });
            } catch (e) {
                await msg.reply("❌ Gagal YT.");
            }
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader System Error:", error);
        return false;
    }
};

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL Sosmed' }
    ]
};