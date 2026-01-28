const config = require('../config');
// 👇 KITA PISAH: Dylux buat IG/TT/YT, Scrapper buat FB
const { tiktok, instagram, youtube } = require('api-dylux');
const getFbVideo = require('fb-downloader-scrapper');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        const url = match[0];

        // --- 1. TIKTOK DOWNLOADER (DYLUX) ---
        if (url.includes('tiktok.com')) {
            await msg.react('⏳');
            try {
                const data = await tiktok(url);
                const videoUrl = data.hdplay || data.play || data.nowm; 
                if (!videoUrl) return msg.reply("❌ Gagal TikTok.");
                
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `🎵 *TikTok*\n👤 ${data.nickname || '-'}`
                });
            } catch (e) { await msg.reply("❌ Error TikTok."); }
            return true;
        }

        // --- 2. INSTAGRAM DOWNLOADER (DYLUX) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                const data = await instagram(url);
                let mediaList = [];
                if (Array.isArray(data)) mediaList = data;
                else if (data.url_list) mediaList = data.url_list;
                else if (data.url) mediaList = [data.url];
                
                if (mediaList.length === 0) return msg.reply("❌ Gagal IG (Private?).");

                for (let i = 0; i < Math.min(mediaList.length, 5); i++) {
                     if (mediaList[i]) await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaList[i], { unsafeMime: true }));
                }
            } catch (e) { await msg.reply("❌ Error IG."); }
            return true;
        }

        // --- 3. FACEBOOK DOWNLOADER (PAKE SPESIALIS BARU) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                console.log(`🔍 FB Specialist Try: ${url}`);
                
                // Pake Library Baru
                const data = await getFbVideo(url);
                
                console.log(`📦 FB Data:`, JSON.stringify(data, null, 2));

                if (!data || !data.success) {
                    return msg.reply("❌ Gagal jebol FB (Link keramat/Private).");
                }

                // Prioritas HD > SD
                const videoUrl = data.hd || data.sd;

                if (!videoUrl) return msg.reply("❌ Link video tidak ditemukan di dalam data.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Video*\n${data.title || ''}`
                });

            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal download FB.");
            }
            return true;
        }

        // --- 4. YOUTUBE (DYLUX) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
             await msg.react('⏳');
             try {
                const data = await youtube(url);
                if (!data || (!data.mp4 && !data.url)) return msg.reply("❌ Gagal YT.");
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4 || data.url, { unsafeMime: true }), { caption: `📺 ${data.title || 'YouTube'}` });
             } catch (e) { await msg.reply("❌ Error YT."); }
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