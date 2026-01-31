const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');

// Helper: Convert URL Video jadi File (MessageMedia)
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

// Helper: Expand Short URL (fb.watch -> facebook.com/...)
async function expandUrl(url) {
    try {
        const response = await axios.head(url, { maxRedirects: 0, validateStatus: status => status >= 200 && status < 400 });
        return response.headers.location || url;
    } catch (error) {
        if (error.response && error.response.status >= 300 && error.response.status < 400) {
            return error.response.headers.location;
        }
        return url;
    }
}

const dl = async (url) => {
    try {
        // ==========================================
        // 📘 FACEBOOK DOWNLOADER (3 LAYERS BACKUP)
        // ==========================================
        if (/facebook\.com|fb\.watch|fb\.com|instagram\.com/i.test(url)) { // Support IG dikit-dikit
            console.log("⏳ Scraping FB/IG: " + url);
            let videoUrl = null;

            // PRE-PROCESS: Expand URL kalau fb.watch (Biar API gak bingung)
            if (url.includes('fb.watch') || url.includes('fb.com')) {
                url = await expandUrl(url);
            }

            // --- LAYER 1: API Ryzendesu (Sering Stabil) ---
            if (!videoUrl) {
                try {
                    console.log("👉 Coba Layer 1 (Ryzen)...");
                    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/fbdown?url=${url}`);
                    if (data && data.data && data.data.length > 0) {
                        // Cari yang HD, kalau gak ada ambil yang pertama
                        const hd = data.data.find(v => v.resolution.includes('HD'));
                        videoUrl = hd ? hd.url : data.data[0].url;
                    }
                } catch (e) { console.log("❌ Layer 1 Gagal."); }
            }

            // --- LAYER 2: API Vreden (Backup) ---
            if (!videoUrl) {
                try {
                    console.log("👉 Coba Layer 2 (Vreden)...");
                    const { data } = await axios.get(`https://api.vreden.my.id/api/fbdown?url=${url}`);
                    if (data && data.result) {
                        videoUrl = data.result.hd || data.result.sd || data.result.url;
                    }
                } catch (e) { console.log("❌ Layer 2 Gagal."); }
            }

            // --- LAYER 3: API AIO (Pamungkas) ---
            if (!videoUrl) {
                try {
                    console.log("👉 Coba Layer 3 (AIO)...");
                    // Kadang link IG/FB bisa tembus pake gnutls
                    const { data } = await axios.get(`https://api.maher-zubair.tech/downloader/facebook?url=${url}`);
                    if (data && data.result) {
                        videoUrl = data.result.hd || data.result.sd;
                    }
                } catch (e) { console.log("❌ Layer 3 Gagal."); }
            }

            // --- FINAL CHECK ---
            if (!videoUrl) throw new Error("Semua server API menyerah. Link mungkin private/dihapus.");

            const media = await urlToMedia(videoUrl);
            if (!media) throw new Error("Gagal download file video.");

            return {
                type: 'Facebook/IG Video',
                media: media
            };
        }

        // ==========================================
        // 🎵 TIKTOK DOWNLOADER (TikWM - Stabil)
        // ==========================================
        if (/tiktok\.com/i.test(url)) {
            console.log("⏳ Scraping TikTok...");
            const { data } = await axios.post('https://www.tikwm.com/api/', { url: url });

            if (!data.data) throw new Error("Video TikTok tidak ditemukan.");

            const videoUrl = data.data.play;
            const media = await urlToMedia(videoUrl);

            return {
                type: 'TikTok Video',
                media: media
            };
        }

        return null;

    } catch (e) {
        console.error("❌ Scraper Error:", e.message);
        return null;
    }
};

module.exports = { dl };