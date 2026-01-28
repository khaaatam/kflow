const config = require('../config');
const axios = require('axios');
// 👇 PERBAIKAN 1: Pake kurung kurawal {} buat ambil fungsi spesifik
const { getFbVideoInfo } = require('fb-downloader-scrapper');
const { instagram, youtube } = require('api-dylux');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        const url = match[0];

        // --- 1. TIKTOK DOWNLOADER (TikWM API + Auto Patch) ---
        if (url.includes('tiktok.com')) {
            await msg.react('⏳');
            try {
                const response = await axios.post('https://www.tikwm.com/api/', {
                    url: url,
                    count: 12,
                    cursor: 0,
                    web: 1,
                    hd: 1
                }, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                const res = response.data;
                if (!res.data) return msg.reply("❌ Gagal ambil data TikTok (API Down).");

                const data = res.data;
                let videoUrl = data.play || data.wmplay;

                // 👇 PERBAIKAN 2: Cek Link Buntung
                if (videoUrl && !videoUrl.startsWith('http')) {
                    videoUrl = `https://www.tikwm.com${videoUrl}`;
                }

                if (!videoUrl) return msg.reply("❌ Video tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `🎵 *TikTok No Watermark*\n👤 ${data.author?.nickname || '-'}\n❤️ ${data.digg_count || '-'}\n📝 ${data.title || '-'}`
                });

            } catch (e) {
                console.error("TikTok API Error:", e);
                await msg.reply("❌ Gagal koneksi ke TikTok Server.");
            }
            return true;
        }

        // --- 2. FACEBOOK DOWNLOADER (Fixed Import) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                console.log(`🔍 FB Specialist Try: ${url}`);

                // 👇 Panggil fungsi yang bener
                const data = await getFbVideoInfo(url);

                console.log(`📦 FB Data:`, JSON.stringify(data, null, 2));

                if (!data) return msg.reply("❌ Gagal jebol FB (Link keramat/Private).");

                // Cari video (biasanya dia kasih sd/hd)
                const videoUrl = data.hd || data.sd;

                if (!videoUrl) return msg.reply("❌ Link video FB tidak ketemu di data.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Video*\n${data.title || ''}`
                });

            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal download FB.");
            }
            return true;
        }

        // --- 3. INSTAGRAM (DYLUX) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                const data = await instagram(url);
                let mediaList = [];
                if (Array.isArray(data)) mediaList = data;
                else if (data.url_list) mediaList = data.url_list;
                else if (data.url) mediaList = [data.url];

                if (mediaList.length === 0) return msg.reply("❌ IG Gagal.");

                for (let i = 0; i < Math.min(mediaList.length, 5); i++) {
                    if (mediaList[i]) await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaList[i], { unsafeMime: true }));
                }
            } catch (e) { await msg.reply("❌ Error IG."); }
            return true;
        }

        // --- 4. YOUTUBE (DYLUX) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            try {
                const data = await youtube(url);
                if (!data || (!data.mp4 && !data.url)) return msg.reply("❌ Gagal YT.");
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4 || data.url, { unsafeMime: true }), { caption: `📺 ${data.title || 'Youtube'}` });
            } catch (e) { await msg.reply("❌ Error YT."); }
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader Error:", error);
        return false;
    }
};

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL Sosmed' }
    ]
};