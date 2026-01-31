const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        // 👇 PERBAIKAN FATAL DI SINI 👇
        // Jangan pake 'text' (karena udah lowercase), pake 'msg.body' (asli)
        const match = msg.body.match(urlRegex);

        if (!match) return false;

        let url = match[0];

        // =========================================================
        // 1. TIKTOK DOWNLOADER (TikWM) - [AMAN]
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
        // 2. FACEBOOK DOWNLOADER (SHARE LINK FIX)
        // =========================================================
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                // Expand Link Share
                if (url.includes('share') || url.includes('/r/') || url.includes('fb.watch')) {
                    console.log(`🔗 Link Share Terdeteksi (RAW): ${url}`);
                    try {
                        const originalUrl = await expandFbUrl(url);
                        if (originalUrl && originalUrl !== url) {
                            url = originalUrl;
                            console.log(`✅ Link Asli Ditemukan: ${url}`);
                        }
                    } catch (err) {
                        console.log("⚠️ Gagal expand, lanjut pake link mentah.");
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
                await msg.reply("❌ Gagal FB. Pastikan link benar (Case Sensitive).");
            }
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader System Error:", error);
        return false;
    }
};

// Fungsi Expand URL
async function expandFbUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        return response.request.res.responseUrl || response.request.responseURL || shortUrl;
    } catch (error) {
        return shortUrl;
    }
}

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL FB & TikTok' }
    ]
}