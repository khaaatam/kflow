const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper');
const { MessageMedia } = require('whatsapp-web.js');
const puppeteer = require('puppeteer'); // Wajib install: npm install puppeteer

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        // Pake text dari handler yang udah diproses
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // =========================================================
        // 1. TIKTOK DOWNLOADER (TikWM)
        // =========================================================
        if (url.includes('tiktok.com')) {
            await msg.react('🎵');
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
        // 2. FACEBOOK DOWNLOADER (HYBRID: SCRAPPER + PUPPETEER)
        // =========================================================
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('🔍');

            // A. Expand Link (Biar link 'share' jadi link asli)
            if (url.includes('share') || url.includes('/r/') || url.includes('fb.watch')) {
                url = await expandFbUrl(url);
            }

            let videoUrl = null;

            // B. COBA CARA 1: Scrapper Ringan (Cepat)
            try {
                const data = await getFbVideoInfo(url);
                if (data && (data.hd || data.sd)) {
                    videoUrl = data.hd || data.sd;
                }
            } catch (e) { console.log('⚠️ Scrapper gagal, switch ke Puppeteer...'); }

            // C. COBA CARA 2: Puppeteer (Badak - Pasti Bisa)
            if (!videoUrl) {
                try {
                    videoUrl = await scrapeFbWithPuppeteer(url);
                } catch (e) { console.error('Puppeteer Error:', e.message); }
            }

            // D. KIRIM HASIL
            if (videoUrl) {
                await msg.react('⬆️');
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Video*\n🔗 ${url}`
                });
            } else {
                msg.reply("❌ Gagal Download FB (Mungkin Private/Hapus).");
            }
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader Error:", error);
        return false;
    }
};

// --- HELPER FUNCTIONS ---

async function expandFbUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        return response.request.res.responseUrl || shortUrl;
    } catch (error) { return shortUrl; }
}

async function scrapeFbWithPuppeteer(url) {
    let browser = null;
    try {
        // Launch Browser pake Config User (Termux Compatible)
        browser = await puppeteer.launch(config.system.puppeteer);
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        // Timeout 60 detik biar kuat loading
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Cari URL Video di dalam HTML
        const src = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video && video.src) return video.src;
            return null;
        });

        await browser.close();
        return src;
    } catch (e) {
        if (browser) await browser.close();
        throw e;
    }
}

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '!fb', desc: 'Download FB' },
        { command: '!tt', desc: 'Download TikTok' },
        { command: '(auto detect)', desc: 'Auto DL Link' }
    ]
};