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
        // 1. TIKTOK DOWNLOADER (TikWM) - [AMAN JAYA]
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
        // 2. FACEBOOK DOWNLOADER (THE FIXER V2)
        // =========================================================
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                // 👇 LOGIC FIX LINK SHARE (VERSI LEBIH PINTAR) 👇
                if (url.includes('share') || url.includes('/r/') || url.includes('fb.watch')) {
                    console.log(`🔗 Link Share Terdeteksi: ${url}`);
                    try {
                        // Kita paksa cari link aslinya sampe ketemu
                        const originalUrl = await expandFbUrl(url);
                        if (originalUrl && originalUrl !== url) {
                            url = originalUrl;
                            console.log(`✅ Link Asli Ditemukan: ${url}`);
                        }
                    } catch (err) {
                        console.log("⚠️ Gagal expand, lanjut pake link mentah.");
                    }
                }

                // Eksekusi Library yang lu bilang WORK
                const data = await getFbVideoInfo(url);

                if (!data) return msg.reply("❌ Gagal FB (Konten Private/Dihapus).");

                const videoUrl = data.hd || data.sd;
                if (!videoUrl) return msg.reply("❌ Video FB tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Video*\n${data.title || ''}`
                });

            } catch (e) {
                console.error("FB Error:", e);
                // Fallback pesimis
                await msg.reply("❌ Gagal FB. Coba buka linknya di browser, terus salin link dari address bar.");
            }
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader System Error:", error);
        return false;
    }
};

// 👇 FUNGSI BUKA LINK (FOLLOW REDIRECTS ENABLED)
async function expandFbUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, {
            // HAPUS maxRedirects: 0 -> Biarin dia ngikutin redirect sampe tujuan akhir
            headers: {
                // Pake User-Agent PC biar dapet link www.facebook.com (bukan m.facebook)
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        // Ambil URL terakhir setelah redirect selesai
        return response.request.res.responseUrl || response.request.responseURL || shortUrl;
    } catch (error) {
        console.log("Expand Error:", error.message);
        return shortUrl;
    }
}

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL FB & TikTok' }
    ]
};