const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');
const RateLimiter = require('../lib/rateLimiter');

// Rate limit: 3 downloads per minute per user
const downloadLimiter = new RateLimiter(60000, 3);

module.exports = async (client, msg, args, senderId, _namaPengirim, _text) => {
    try {
        // Rate limit check
        if (!downloadLimiter.check(senderId)) {
            await msg.reply("⏳ Terlalu banyak download. Tunggu sebentar.");
            return false;
        }

        // 👇 INI KUNCINYA: Langsung ambil link dari body pesan asli!
        // Gak peduli argumen text/args error, yang penting ada link di chat.
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = msg.body.match(urlRegex);

        if (!match) return false; // Gak ada link? Skip.

        let url = match[0]; // Ambil link pertama yang ketemu

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
                if (!data) return msg.reply("❌ Gagal TikTok (API Down/Video Hapus).");

                let videoUrl = data.play || data.wmplay;
                if (videoUrl && !videoUrl.startsWith('http')) videoUrl = `https://www.tikwm.com${videoUrl}`;

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `🎵 *TikTok*\n👤 ${data.author?.nickname || '-'}`
                });
                await msg.react('✅');
            } catch (e) {
                logger.error("TikTok Error:", e);
                await msg.reply("❌ Error TikTok.");
            }
            return true;
        }

        // =========================================================
        // 2. FACEBOOK DOWNLOADER (SHARE LINK FIX)
        // =========================================================
        // Regex diperluas biar nangkep semua variasi FB
        if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) {
            await msg.react('⏳');
            try {
                // Expand Link Share (Penting buat fb.watch)
                if (url.includes('share') || url.includes('/r/') || url.includes('fb.watch') || url.includes('fb.com')) {
                    logger.info(`Link Share Terdeteksi (RAW): ${url}`);
                    try {
                        const originalUrl = await expandFbUrl(url);
                        if (originalUrl && originalUrl !== url) {
                            url = originalUrl;
                            logger.info(`Link Asli Ditemukan: ${url}`);
                        }
                    } catch {
                        logger.warn("Gagal expand, lanjut pake link mentah.");
                    }
                }

                // Pake Library Andalan Lu
                const data = await getFbVideoInfo(url);

                if (!data) return msg.reply("❌ Gagal FB (Private/Hapus).");

                const videoUrl = data.hd || data.sd;
                if (!videoUrl) return msg.reply("❌ Video FB tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Downloader*\nBot Created by ${config.creator}`
                });
                await msg.react('✅');

            } catch (e) {
                logger.error("FB Error:", e);
                await msg.reply("❌ Gagal FB. Pastikan link publik & valid.");
            }
            return true;
        }

        // Kalau link lain (IG/YouTube) bisa ditambah di sini...
        return false;

    } catch {
        logger.error("Downloader System Error");
        return false;
    }
};

// Fungsi Expand URL (Biar fb.watch kebaca)
async function expandFbUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        return response.request.res.responseUrl || response.request.responseURL || shortUrl;
    } catch {
        return shortUrl;
    }
}

// Metadata Tetap Lengkap Biar Command Manual Juga Jalan
module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '!dl', desc: 'Download media', isPublic: true },
        { command: '!tiktok', desc: 'Tiktok Downloader', isPublic: true },
        { command: '!fb', desc: 'Facebook Downloader', isPublic: true },
        { command: '(Auto Detect)', desc: 'Auto Downloader Link', isPublic: true }
    ]
};