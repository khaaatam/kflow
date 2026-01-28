const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper'); // Spesialis FB
const { youtube, igdl } = require('btch-downloader'); // Spesialis YT & IG
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // --- 1. TIKTOK (AXIOS - TIKWM) ---
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
            } catch (e) { await msg.reply("❌ Error TikTok."); }
            return true;
        }

        // --- 2. FACEBOOK (SCRAPPER + EXPANDER) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                // 👇 FITUR RAHASIA: Benerin Link Share/Shortlink dulu
                if (url.includes('share') || url.includes('fb.watch') || url.includes('/v/')) {
                    console.log(`🔗 Link Singkatan terdeteksi: ${url}`);
                    try {
                        url = await expandUrl(url);
                        console.log(`✅ Link Asli: ${url}`);
                    } catch (err) {
                        console.log("⚠️ Gagal expand URL, pake link asli aja.");
                    }
                }

                console.log(`🔍 FB Try: ${url}`);
                const data = await getFbVideoInfo(url);
                
                if (!data) return msg.reply("❌ FB Gagal (Private?).");

                const videoUrl = data.hd || data.sd;
                if (!videoUrl) return msg.reply("❌ Video FB tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Video*\n${data.title || ''}`
                });

            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal FB.");
            }
            return true;
        }

        // --- 3. INSTAGRAM (BTCH) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                const data = await igdl(url);
                if (!data || data.length === 0) return msg.reply("❌ IG Gagal.");

                for (let i = 0; i < Math.min(data.length, 5); i++) {
                     if (data[i].url) await client.sendMessage(msg.from, await MessageMedia.fromUrl(data[i].url, { unsafeMime: true }));
                }
            } catch (e) { await msg.reply("❌ Error IG."); }
            return true;
        }

        // --- 4. YOUTUBE (BTCH) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
             await msg.react('⏳');
             try {
                const data = await youtube(url);
                if (!data || !data.mp4) return msg.reply("❌ Gagal YT.");
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4, { unsafeMime: true }), { caption: `📺 ${data.title || 'YouTube'}` });
             } catch (e) { await msg.reply("❌ Error YT."); }
             return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader Error:", error);
        return false;
    }
};

// 👇 FUNGSI RAHASIA BUAT BENERIN LINK FB
async function expandUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, { 
            maxRedirects: 0, // Matikan auto redirect axios biar kita bisa tangkep header location
            validateStatus: status => status >= 200 && status < 400 
        });
        return response.headers.location || shortUrl; // Ambil lokasi redirectnya
    } catch (error) {
        if (error.response && error.response.status >= 300 && error.response.status < 400) {
            return error.response.headers.location;
        }
        return shortUrl;
    }
}

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL Sosmed' }
    ]
};