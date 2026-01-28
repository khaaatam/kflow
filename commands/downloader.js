const config = require('../config');
const axios = require('axios');
const caliph = require('caliph-api'); // 👇 ENGINE BARU
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // --- 1. TIKTOK (TETEP PAKE AXIOS - KARENA SUKSES) ---
        if (url.includes('tiktok.com')) {
            await msg.react('⏳');
            try {
                const response = await axios.post('https://www.tikwm.com/api/', {
                    url: url, count: 12, cursor: 0, web: 1, hd: 1
                }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } });

                const data = response.data.data;
                if (!data) return msg.reply("❌ Gagal TikTok.");

                let videoUrl = data.play || data.wmplay;
                if (videoUrl && !videoUrl.startsWith('http')) videoUrl = `https://www.tikwm.com${videoUrl}`;

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `🎵 *TikTok*\n👤 ${data.author?.nickname || '-'}`
                });
            } catch (e) { 
                console.error("TikTok Error:", e);
                await msg.reply("❌ Error TikTok."); 
            }
            return true;
        }

        // --- 2. INSTAGRAM (CALIPH) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                // Caliph IG Downloader
                const result = await caliph.downloader.instagram(url);
                
                // Cek format output (biasanya array)
                console.log("📸 IG Data:", result);

                if (!result || result.length === 0) {
                    return msg.reply("❌ Gagal IG (Mungkin akun private/Link expired).");
                }

                // Kirim maksimal 5 slide
                for (let i = 0; i < Math.min(result.length, 5); i++) {
                    const mediaUrl = result[i].url;
                    if (mediaUrl) {
                        await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true }));
                    }
                }
            } catch (e) { 
                console.error("IG Error:", e);
                await msg.reply("❌ Error IG (Server Down/Private)."); 
            }
            return true;
        }

        // --- 3. FACEBOOK (CALIPH) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                // Fitur rahasia: Expand URL dulu (biar link share tembus)
                if (url.includes('share') || url.includes('fb.watch') || url.includes('/v/')) {
                    try { url = await expandUrl(url); } catch (e) {}
                }
                
                console.log(`🔍 FB Try: ${url}`);
                const result = await caliph.downloader.facebook(url);
                console.log("📦 FB Data:", result);

                if (!result || !result.result) return msg.reply("❌ Gagal FB.");

                // Ambil HD atau SD
                // Format caliph fb: { result: { url: "...", quality: "HD" }, ... }
                // Kadang dia balikin array, kita cari yang mp4
                
                let videoUrl = null;
                const res = result.result;

                if (Array.isArray(res)) {
                    // Cari yang HD
                    const hd = res.find(x => x.quality === 'HD' || x.url.includes('hd'));
                    const sd = res.find(x => x.quality === 'SD' || x.url.includes('sd'));
                    videoUrl = (hd || sd || res[0]).url;
                } else {
                     videoUrl = res.url;
                }

                if (!videoUrl) return msg.reply("❌ Video FB Kosong.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook*`
                });
            } catch (e) { 
                console.error("FB Error:", e);
                await msg.reply("❌ Error FB."); 
            }
            return true;
        }

        // --- 4. YOUTUBE (CALIPH) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
             await msg.react('⏳');
             try {
                const result = await caliph.downloader.youtube.video(url);
                console.log("📺 YT Data:", result);

                if (!result || !result.result) return msg.reply("❌ Gagal YT.");

                const videoUrl = result.result.url || result.result.link; 
                const title = result.result.title || 'YouTube Video';

                if (!videoUrl) return msg.reply("❌ Link Video YT tidak ketemu.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), { 
                    caption: `📺 *${title}*` 
                });
             } catch (e) { 
                 console.error("YT Error:", e);
                 await msg.reply("❌ Error YT (Coba video durasi pendek)."); 
             }
             return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader Error:", error);
        return false;
    }
};

// Fungsi Expand URL (Tetep dipake buat FB)
async function expandUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, { maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
        return response.headers.location || shortUrl;
    } catch (error) {
        if (error.response && error.response.status >= 300 && error.response.status < 400) return error.response.headers.location;
        return shortUrl;
    }
}

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL Sosmed (Caliph)' }
    ]
};