const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const getFbVideoInfo = require("fb-downloader-scrapper"); // 👈 KITA PAKE INI LAGI

// Helper: Convert URL Video jadi File
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
        console.error("⚠️ Gagal convert media:", e.message);
        return null;
    }
}

// Helper: Expand Short URL (Penting buat fb.watch)
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
        // 📘 FACEBOOK (LIBRARY FIRST -> API BACKUP)
        // ==========================================
        if (/facebook\.com|fb\.watch|fb\.com|instagram\.com/i.test(url)) {
            console.log("⏳ Scraping FB: " + url);
            let videoUrl = null;

            // 1. EXPAND URL DULU (Wajib buat fb.watch)
            if (url.includes('fb.watch') || url.includes('fb.com')) {
                url = await expandUrl(url);
            }

            // 2. COBA PAKE LIBRARY (CARA LAMA YANG WORKS)
            try {
                console.log("👉 Method 1: Library Local...");
                const result = await getFbVideoInfo(url);
                videoUrl = result.hd || result.sd;
            } catch (e) {
                console.log("⚠️ Library Gagal, mencoba API backup...");
            }

            // 3. COBA PAKE API (KALAU LIBRARY GAGAL)
            if (!videoUrl) {
                try {
                    console.log("👉 Method 2: API Ryzendesu...");
                    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/fbdown?url=${url}`);
                    if (data?.data?.length > 0) {
                        const hd = data.data.find(v => v.resolution.includes('HD'));
                        videoUrl = hd ? hd.url : data.data[0].url;
                    }
                } catch (e) { console.log("⚠️ API Gagal."); }
            }

            if (!videoUrl) throw new Error("Gagal download. Video private atau dihapus.");

            const media = await urlToMedia(videoUrl);
            return { type: 'Facebook Video', media: media };
        }

        // ==========================================
        // 🎵 TIKTOK (TikWM)
        // ==========================================
        if (/tiktok\.com/i.test(url)) {
            console.log("⏳ Scraping TikTok...");
            const { data } = await axios.post('https://www.tikwm.com/api/', { url: url });
            if (!data.data) throw new Error("Video TikTok tidak ditemukan.");

            const media = await urlToMedia(data.data.play);
            return { type: 'TikTok Video', media: media };
        }

        return null;

    } catch (e) {
        console.error("❌ Scraper Error:", e.message);
        return null;
    }
};

module.exports = { dl };