const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const getFbVideoInfo = require("fb-downloader-scrapper");

// Helper: Download URL jadi MessageMedia (Base64)
// Ini PENTING biar bot bisa kirim video sebagai file, bukan cuma link.
async function urlToMedia(url, mimetype = 'video/mp4', filename = 'video.mp4') {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return new MessageMedia(mimetype, base64, filename);
    } catch (e) {
        console.error("Gagal download buffer:", e.message);
        return null;
    }
}

const dl = async (url) => {
    try {
        // --- 1. FACEBOOK DOWNLOADER ---
        if (/facebook\.com|fb\.watch/i.test(url)) {
            console.log("⏳ Scraping Facebook...");
            const result = await getFbVideoInfo(url);

            // Library ini biasanya balikin sd/hd. Kita prioritasin HD.
            const videoUrl = result.hd || result.sd;

            if (!videoUrl) throw new Error("Video FB tidak ditemukan (Private/Dihapus).");

            const media = await urlToMedia(videoUrl);
            return {
                type: 'Facebook Video',
                media: media
            };
        }

        // --- 2. TIKTOK DOWNLOADER (Via Public API TikWM) ---
        if (/tiktok\.com/i.test(url)) {
            console.log("⏳ Scraping TikTok...");
            const { data } = await axios.post('https://www.tikwm.com/api/', { url: url });

            if (!data.data) throw new Error("Video TikTok tidak ditemukan.");

            // Ambil yang No Watermark
            const videoUrl = data.data.play;
            const media = await urlToMedia(videoUrl);

            return {
                type: 'TikTok Video',
                media: media
            };
        }

        // --- 3. INSTAGRAM (Placeholder / Next Update) ---
        // Sementara return null dulu karena IG sering ganti algoritma
        if (/instagram\.com/i.test(url)) {
            throw new Error("Fitur IG lagi maintenance bang, pake FB/TikTok dulu ya.");
        }

        return null;

    } catch (e) {
        console.error("❌ Scraper Error:", e.message);
        return null;
    }
};

module.exports = { dl };