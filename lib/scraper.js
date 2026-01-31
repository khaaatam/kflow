const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const getFbVideoInfo = require("fb-downloader-scrapper");

// Helper: Convert URL Video jadi File (MessageMedia)
// Biar bot ngirimnya sebagai VIDEO ASLI, bukan link doang.
async function urlToMedia(url, mimetype = 'video/mp4', filename = 'video.mp4') {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return new MessageMedia(mimetype, base64, filename);
    } catch (e) {
        console.error("⚠️ Gagal convert URL ke Media:", e.message);
        return null;
    }
}

const dl = async (url) => {
    try {
        // ==========================================
        // 📘 FACEBOOK DOWNLOADER (MULTI-METHOD)
        // ==========================================
        if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) {
            console.log("⏳ Mencoba download FB...");
            let videoUrl = null;

            // --- METHOD 1: Pake Library (fb-downloader-scrapper) ---
            try {
                const result = await getFbVideoInfo(url);
                // Ambil HD dulu, kalau gak ada baru SD
                videoUrl = result.hd || result.sd;
            } catch (e) {
                console.log("⚠️ Method 1 (Library) Gagal, mencoba backup...");
            }

            // --- METHOD 2: Pake API Cadangan (Kalau Method 1 Gagal) ---
            if (!videoUrl) {
                try {
                    // Pake API Public (Gratis & Lumayan Stabil)
                    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/fbdown?url=${url}`);
                    // Biasanya API ini balikin array urutan HD -> SD
                    if (data && data.data && data.data.length > 0) {
                        videoUrl = data.data.find(v => v.resolution.includes('HD'))?.url || data.data[0].url;
                    }
                } catch (e) {
                    console.log("⚠️ Method 2 (API) Gagal.");
                }
            }

            // --- CHECK FINAL ---
            if (!videoUrl) throw new Error("Semua metode gagal. Video diprivate atau dihapus.");

            const media = await urlToMedia(videoUrl);
            if (!media) throw new Error("Gagal mendownload file video.");

            return {
                type: 'Facebook Video',
                media: media
            };
        }

        // ==========================================
        // 🎵 TIKTOK DOWNLOADER
        // ==========================================
        if (/tiktok\.com/i.test(url)) {
            console.log("⏳ Scraping TikTok...");
            // API TikWM (Paling Stabil buat TikTok No Watermark)
            const { data } = await axios.post('https://www.tikwm.com/api/', { url: url });

            if (!data.data) throw new Error("Video TikTok tidak ditemukan.");

            const videoUrl = data.data.play; // URL No Watermark
            const media = await urlToMedia(videoUrl);

            return {
                type: 'TikTok Video',
                media: media
            };
        }

        // ==========================================
        // 📸 INSTAGRAM (Placeholder)
        // ==========================================
        if (/instagram\.com/i.test(url)) {
            // IG susah ditembus tanpa login sekarang, mending skip dulu daripada error
            throw new Error("Fitur IG lagi maintenance. Pake FB/TikTok dulu ya.");
        }

        return null; // Link tidak dikenali

    } catch (e) {
        console.error("❌ Scraper Error:", e.message);
        return null;
    }
};

module.exports = { dl };