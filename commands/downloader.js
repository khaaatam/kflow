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

        // --- 1. TIKTOK (AXIOS - TIKWM) [AMAN JAYA] ---
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

        // --- 2. FACEBOOK (SCRAPPER + EXPANDER) [AMAN JAYA] ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                if (url.includes('share') || url.includes('fb.watch') || url.includes('/v/')) {
                    try { url = await expandUrl(url); } catch (e) {}
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

        // --- 3. INSTAGRAM (COBALT V10) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                const data = await cobalt(url);
                
                if (!data || data.status === 'error') {
                    console.log("IG Error Log:", data);
                    return msg.reply("❌ IG Gagal (Cobalt Error).");
                }

                // Cobalt v10 response: { status: 'stream'/'picker', url: '...', picker: [...] }
                if (data.status === 'picker') {
                    for (const item of data.picker) {
                        await client.sendMessage(msg.from, await MessageMedia.fromUrl(item.url, { unsafeMime: true }));
                    }
                } else if (data.url) {
                    await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.url, { unsafeMime: true }));
                } else {
                    return msg.reply("❌ Media IG tidak ditemukan.");
                }
            } catch (e) { 
                console.error("IG Error:", e);
                await msg.reply("❌ Error IG."); 
            }
            return true;
        }

        // --- 4. YOUTUBE (COBALT V10) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
             await msg.react('⏳');
             try {
                const data = await cobalt(url);

                if (!data || data.status === 'error' || !data.url) {
                    return msg.reply("❌ Gagal YT.");
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

// 👇 FUNGSI EXPAND URL (FB)
async function expandUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, { maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
        return response.headers.location || shortUrl;
    } catch (error) {
        if (error.response && error.response.status >= 300 && error.response.status < 400) return error.response.headers.location;
        return shortUrl;
    }
}

// 👇 FUNGSI COBALT V10 (RUMAH BARU)
async function cobalt(url) {
    try {
        const response = await axios.post('https://api.cobalt.tools', { // 👈 Endpoint Baru (Tanpa /api/json)
            url: url,
            // v10 gak butuh banyak parameter codec aneh-aneh buat default
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
        { command: '(Auto Detect)', desc: 'DL Sosmed (Cobalt V10)' }
    ]
};