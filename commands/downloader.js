const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper'); // Balik pake ini (Output Video Jernih)
const { igdl, youtube } = require('btch-downloader'); // Buat IG & YT
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // --- 1. TIKTOK (AXIOS - SUKSES) ---
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
                // 👇 LANGKAH PENTING: Benerin link dulu sebelum dikasih ke scrapper
                if (url.includes('share') || url.includes('fb.watch') || url.includes('/v/')) {
                    try {
                        console.log(`🔗 Link Share terdeteksi, expanding...`);
                        url = await expandUrl(url);
                        console.log(`✅ Link Asli: ${url}`);
                    } catch (e) {
                        console.log("⚠️ Gagal expand, coba link mentah.");
                    }
                }

                // Pake library favorite lu
                const data = await getFbVideoInfo(url);

                if (!data) return msg.reply("❌ Gagal FB (Private/Link Error).");

                // Scrapper ini outputnya .mp4 yang solid, jadi gak bakal jadi dokumen
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

                if (!data || data.length === 0) {
                    return msg.reply("❌ IG Gagal. (Mungkin akun Private atau IP Server keblokir).");
                }

                for (let i = 0; i < Math.min(data.length, 5); i++) {
                    if (data[i].url) await client.sendMessage(msg.from, await MessageMedia.fromUrl(data[i].url, { unsafeMime: true }));
                }
            } catch (e) {
                console.error("IG Error:", e);
                await msg.reply("❌ Error IG.");
            }
            return true;
        }

        // --- 4. YOUTUBE (BTCH) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            try {
                const data = await youtube(url);
                if (!data || !data.mp4) return msg.reply("❌ Gagal YT.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4, { unsafeMime: true }), {
                    caption: `📺 *${data.title || 'YouTube'}*`
                });
            } catch (e) {
                console.error("YT Error:", e);
                await msg.reply("❌ Error YT.");
            }
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader System Error:", error);
        return false;
    }
};

// Fungsi Expand URL (Juru Selamat FB)
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
        { command: '(Auto Detect)', desc: 'DL Sosmed' }
    ]
};