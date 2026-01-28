const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper'); // FB Tetap Ini
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // --- 1. TIKTOK (AXIOS - TIKWM) [SUKSES - JANGAN UBAH] ---
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

        // --- 2. FACEBOOK (SCRAPPER + EXPANDER) [SUKSES - JANGAN UBAH] ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                if (url.includes('share') || url.includes('fb.watch') || url.includes('/v/')) {
                    try { url = await expandUrl(url); } catch (e) { }
                }

                const data = await getFbVideoInfo(url);
                if (!data) return msg.reply("❌ Gagal FB.");

                const videoUrl = data.hd || data.sd;
                if (!videoUrl) return msg.reply("❌ Video FB Kosong.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Video*\n${data.title || ''}`
                });

            } catch (e) { await msg.reply("❌ Gagal FB."); }
            return true;
        }

        // --- 3. INSTAGRAM (COBALT API) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                // Tembak API Cobalt
                const data = await cobalt(url);

                if (!data || data.status === 'error') return msg.reply("❌ IG Gagal (Cobalt Error).");

                // Cobalt kadang balikin 'picker' (kalo multiple slide) atau 'stream' (kalo single)
                if (data.status === 'picker') {
                    // Multiple Slide
                    for (const item of data.picker) {
                        await client.sendMessage(msg.from, await MessageMedia.fromUrl(item.url, { unsafeMime: true }));
                    }
                } else {
                    // Single Post/Reels
                    await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.url, { unsafeMime: true }));
                }
            } catch (e) {
                console.error("IG Error:", e);
                await msg.reply("❌ Error IG (Server Busy).");
            }
            return true;
        }

        // --- 4. YOUTUBE (COBALT API) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            try {
                // Tembak API Cobalt
                const data = await cobalt(url);

                if (!data || data.status === 'error' || !data.url) {
                    return msg.reply("❌ Gagal YT (Cobalt Busy).");
                }

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.url, { unsafeMime: true }), {
                    caption: `📺 *YouTube Video*`
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

// 👇 FUNGSI EXPAND URL (BUAT FB)
async function expandUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, { maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
        return response.headers.location || shortUrl;
    } catch (error) {
        if (error.response && error.response.status >= 300 && error.response.status < 400) return error.response.headers.location;
        return shortUrl;
    }
}

// 👇 FUNGSI COBALT (BUAT IG & YT)
async function cobalt(url) {
    try {
        const response = await axios.post('https://api.cobalt.tools/api/json', {
            url: url,
            vCodec: "h264",
            vQuality: "720",
            aFormat: "mp3",
            filenamePattern: "basic"
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error("Cobalt API Error:", error.response ? error.response.data : error.message);
        return null;
    }
}

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL Sosmed (Cobalt)' }
    ]
};