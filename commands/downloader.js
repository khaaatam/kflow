const config = require('../config');
// 👇 KITA PAKE LIBRARY BARU: api-dylux
const { tiktok, instagram, facebook, youtube } = require('api-dylux');
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
                // api-dylux biasanya balikin object simple
                const data = await tiktok(url);

                // Cek data (Spy Mode)
                console.log(`🎵 TikTok Data:`, data);

                // Ambil video (HD > SD > Nowm)
                const videoUrl = data.hdplay || data.play || data.nowm;

                if (!videoUrl) return msg.reply("❌ Gagal. Video tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `🎵 *TikTok Downloader*\nAuthor: ${data.nickname || '-'}\nDesc: ${data.title || '-'}`
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
                const data = await instagram(url);
                // IG api-dylux biasanya balikin array url (data.url_list atau langsung array)
                console.log(`📸 IG Data:`, data);

                let mediaList = [];
                if (Array.isArray(data)) mediaList = data;
                else if (data.url_list) mediaList = data.url_list;
                else if (data.url) mediaList = [data.url];

                if (mediaList.length === 0) return msg.reply("❌ Gagal/Private Account.");

                // Kirim max 5 slide
                for (let i = 0; i < Math.min(mediaList.length, 5); i++) {
                    // Filter: Pastikan URL valid
                    if (mediaList[i]) {
                        await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaList[i], { unsafeMime: true }));
                    }
                }
            } catch (e) {
                console.error("IG Error:", e);
                await msg.reply("❌ Gagal IG (Mungkin Private/Login Required).");
            }
            return true;
        }

        // --- 3. FACEBOOK DOWNLOADER ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                console.log(`🔍 FB Try: ${url}`);
                const data = await facebook(url);
                console.log(`📦 FB Data:`, JSON.stringify(data, null, 2));

                // api-dylux biasanya format: { hd: 'url...', sd: 'url...', ... }
                // atau array: [{ quality: 'HD', url: '...' }]

                let videoUrl = null;

                if (Array.isArray(data)) {
                    const hd = data.find(x => x.quality === 'HD');
                    const sd = data.find(x => x.quality === 'SD');
                    videoUrl = (hd || sd || data[0]).url;
                } else {
                    videoUrl = data.hd || data.sd || data.Normal_video;
                }

                if (!videoUrl) return msg.reply("❌ Video FB tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Downloader*`
                });

            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal FB.");
            }
            return true;
        }

        // --- 4. YOUTUBE DOWNLOADER ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            try {
                const data = await youtube(url);
                // YT dylux format: { mp4: '...', title: '...' }

                if (!data || (!data.mp4 && !data.url)) return msg.reply("❌ Gagal YT.");

                const vidUrl = data.mp4 || data.url;

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(vidUrl, { unsafeMime: true }), {
                    caption: `📺 *${data.title || 'YouTube Video'}*`
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
        { command: '(Auto Detect)', desc: 'DL Sosmed (Dylux)' }
    ]
};