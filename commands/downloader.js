const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // =========================================================
        // 1. TIKTOK DOWNLOADER (TikWM)
        // =========================================================
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

        // =========================================================
        // 2. FACEBOOK DOWNLOADER (Fixed Share Link)
        // =========================================================
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                // Logic Fix Link Share
                if (url.includes('share') || url.includes('/r/')) {
                    console.log(`🔗 Link Share Terdeteksi: ${url}`);
                    try {
                        const originalUrl = await expandFbUrl(url);
                        if (originalUrl) {
                            url = originalUrl;
                            console.log(`✅ Link Asli: ${url}`);
                        }
                    } catch (err) {
                        console.log("⚠️ Gagal expand, coba link mentah...");
                    }
                }

                const data = await getFbVideoInfo(url);

                if (!data) return msg.reply("❌ Gagal FB (Private/Hapus).");

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

        return false;

    } catch (error) {
        console.error("Downloader System Error:", error);
        return false;
    }
};

// 👇 Fungsi buat buka link share FB (PENTING)
async function expandFbUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, {
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
            }
        });
        return response.headers.location || shortUrl;
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
        { command: '(Auto Detect)', desc: 'DL FB & TikTok Only' }
    ]
};