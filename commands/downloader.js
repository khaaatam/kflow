const config = require('../config');
const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper'); // FB Tetap Ini
const { youtubedl, youtubedlv2, instagramdl, instagramdlv2, instagramdlv3, instagramdlv4 } = require('@bochilteam/scraper'); // 👇 PASUKAN KHUSUS
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // --- 1. TIKTOK (AXIOS - SUKSES) ---
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

        // --- 2. FACEBOOK (SCRAPPER + EXPANDER - SUKSES) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                // Expand Link
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

            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal FB.");
            }
            return true;
        }

        // --- 3. INSTAGRAM (BOCHIL TEAM) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                // Kita coba beberapa engine IG dari Bochil (v1, v2, v3, v4) sampe ada yang tembus
                let data = await instagramdl(url).catch(async () => 
                           await instagramdlv2(url)).catch(async () => 
                           await instagramdlv3(url)).catch(async () => 
                           await instagramdlv4(url));
                
                if (!data || data.length === 0) return msg.reply("❌ IG Gagal (Akun Private/API Error).");

                // Bochil balikin array object { url: '...', thumbnail: '...' }
                for (let i = 0; i < Math.min(data.length, 5); i++) {
                     const mediaUrl = data[i].url;
                     if (mediaUrl) await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true }));
                }
            } catch (e) { 
                console.error("IG Error:", e);
                await msg.reply("❌ Error IG (IP Blocked/Private)."); 
            }
            return true;
        }

        // --- 4. YOUTUBE (BOCHIL TEAM) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
             await msg.react('⏳');
             try {
                // Coba Engine V1 dulu, kalau gagal V2
                let data = await youtubedl(url).catch(async () => await youtubedlv2(url));
                
                if (!data || !data.video) return msg.reply("❌ Gagal YT.");

                // Ambil kualitas terbaik (biasanya key-nya '720p', '480p', etc)
                // data.video adalah object: { '360p': { fileSize:..., download: async() }, '720p': ... }
                
                const quality = data.video['720p'] || data.video['480p'] || data.video['360p'] || data.video['auto'];
                
                if (!quality) return msg.reply("❌ Video YT tidak ada link download.");
                
                // KITA HARUS EKSEKUSI FUNGSI DOWNLOADNYA
                const dlUrl = await quality.download();

                if (!dlUrl) return msg.reply("❌ Gagal generate link YT.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(dlUrl, { unsafeMime: true }), { 
                    caption: `📺 *${data.title || 'YouTube'}*` 
                });
             } catch (e) { 
                 console.error("YT Error:", e);
                 await msg.reply("❌ Error YT."); 
             }
             return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader Error:", error);
        return false;
    }
};

// Fungsi Expand URL
async function expandUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, { maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
        return response.headers.location || shortUrl;
    } catch (error) {
        if (error.response && error.response.status >= 300 && error.response.status < 400) return error.response.headers.location;
        return shortUrl;
    }
}

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect)', desc: 'DL Sosmed (Bochil)' }
    ]
};