const config = require('../config');
// 👇 PERBAIKAN: Ganti 'facebook' jadi 'fbdl'
const { tiktok, instagram, fbdl, youtube } = require('api-dylux');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        const url = match[0];

        // ... (KODE TIKTOK SAMA INSTAGRAM BIARIN SAMA) ...
        
        // --- 1. TIKTOK DOWNLOADER ---
        if (url.includes('tiktok.com')) {
             // ... (kode tiktok lama lu) ...
             // Kalo males copas, anggep aja ini kode tiktok yang tadi
             await msg.react('⏳');
             try {
                const data = await tiktok(url);
                const videoUrl = data.hdplay || data.play || data.nowm; 
                if (!videoUrl) return msg.reply("❌ Gagal TikTok.");
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), { caption: '🎵 TikTok' });
             } catch (e) { await msg.reply("❌ Error TikTok."); }
             return true;
        }

        // --- 2. INSTAGRAM DOWNLOADER ---
        if (url.includes('instagram.com')) {
             // ... (kode instagram lama lu) ...
             await msg.react('⏳');
             try {
                const data = await instagram(url);
                let mediaList = [];
                if (Array.isArray(data)) mediaList = data;
                else if (data.url_list) mediaList = data.url_list;
                else if (data.url) mediaList = [data.url];
                
                for (let i = 0; i < Math.min(mediaList.length, 5); i++) {
                     if (mediaList[i]) await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaList[i], { unsafeMime: true }));
                }
             } catch (e) { await msg.reply("❌ Error IG."); }
             return true;
        }

        // --- 3. FACEBOOK DOWNLOADER (INI YANG KITA BENERIN) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                console.log(`🔍 FB Try: ${url}`);
                
                // 👇 PANGGIL 'fbdl', BUKAN 'facebook'
                const data = await fbdl(url); 
                
                console.log(`📦 FB Data:`, JSON.stringify(data, null, 2));

                let videoUrl = null;
                // Cek variasi output api-dylux
                if (Array.isArray(data)) {
                    const hd = data.find(x => x.quality === 'HD');
                    const sd = data.find(x => x.quality === 'SD');
                    videoUrl = (hd || sd || data[0]).url;
                } else {
                    // Kadang dia kasih object langsung
                    videoUrl = data.videoUrl || data.sd || data.hd || data.url;
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

        // --- 4. YOUTUBE ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
             // ... (kode youtube lama lu) ...
             await msg.react('⏳');
             try {
                const data = await youtube(url);
                if (!data || (!data.mp4 && !data.url)) return msg.reply("❌ Gagal YT.");
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4 || data.url, { unsafeMime: true }), { caption: '📺 YT' });
             } catch (e) { await msg.reply("❌ Error YT."); }
             return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader System Error:", error);
        return false;
    }
};