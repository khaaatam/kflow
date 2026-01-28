const config = require('../config');
// Pastiin import-nya bener (fbdown, bukan facebook)
const { ttdl, igdl, youtube, fbdown } = require('btch-downloader');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        const url = match[0];

        // --- 1. TIKTOK DOWNLOADER ---
        if (url.includes('tiktok.com')) {
            await msg.react('⏳');
            try {
                const data = await ttdl(url);
                const videoUrl = data.url || data.video || data.nowm || data.music;
                if (!videoUrl) return msg.reply("❌ Gagal. Video TikTok tidak ketemu.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `🎵 *TikTok*\n👤 ${data.nickname || '-'}\n📝 ${data.title || '-'}`
                });
            } catch (e) {
                console.error("TikTok Error:", e);
                await msg.reply("❌ Gagal download TikTok.");
            }
            return true;
        }

        // --- 2. INSTAGRAM DOWNLOADER ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                const data = await igdl(url);
                if (!data || data.length === 0) return msg.reply("❌ Akun Private / Gagal.");

                for (let i = 0; i < Math.min(data.length, 5); i++) {
                    await client.sendMessage(msg.from, await MessageMedia.fromUrl(data[i].url, { unsafeMime: true }));
                }
            } catch (e) {
                await msg.reply("❌ Gagal download IG.");
            }
            return true;
        }

        // --- 3. FACEBOOK DOWNLOADER (YANG LAGI BERMASALAH) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                console.log(`🔍 Mencoba FB Downloader untuk: ${url}`);
                const data = await fbdown(url);

                // 👇 [SPY MODE] LIAT DI TERMINAL TERMUX LU NANTI MUNCUL APA 👇
                console.log("📦 DATA DARI FB:", JSON.stringify(data, null, 2));

                if (!data) return msg.reply("❌ Gagal ambil data FB.");

                // 👇 [SAPU JAGAT] Cek semua kemungkinan nama
                const videoUrl = data.url || data.video || data.hd || data.sd || data.Normal_video || data.HD || data.link;

                if (!videoUrl) {
                    return msg.reply("❌ Video tidak ditemukan/private. Cek terminal buat liat log-nya.");
                }

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Downloader*`
                });
            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal download FB (Mungkin Private).");
            }
            return true;
        }

        // --- 4. YOUTUBE DOWNLOADER ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            try {
                const data = await youtube(url);
                if (!data || !data.mp4) return msg.reply("❌ Gagal YT.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4, { unsafeMime: true }), {
                    caption: `📺 *${data.title}*`
                });
            } catch (e) {
                await msg.reply("❌ Gagal download YT.");
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