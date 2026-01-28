const config = require('../config');
const axios = require('axios');
const snapsave = require('snapsave-downloader2'); // Spesialis FB
const instagramDl = require('instagram-url-direct'); // Spesialis IG
const ytdl = require('ytdl-core'); // Spesialis YT
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // --- 1. TIKTOK (AXIOS - TIKWM) ---
        // (Tetep pake ini karena udah terbukti sukses)
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
            } catch (e) { 
                console.error("TikTok Error:", e);
                await msg.reply("❌ Error TikTok."); 
            }
            return true;
        }

        // --- 2. FACEBOOK (SNAPSAVE) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                // Fitur Expand URL (Biar link share tembus)
                if (url.includes('share') || url.includes('fb.watch') || url.includes('/v/')) {
                    try { url = await expandUrl(url); } catch (e) {}
                }

                console.log(`🔍 FB SnapSave Try: ${url}`);
                const data = await snapsave(url);
                
                // Cek hasil snapsave
                if (!data || !data.data) return msg.reply("❌ Gagal FB (Private/Link Error).");

                // SnapSave balikin array resolusi. Kita cari yang paling tinggi tapi masih masuk akal (720p/HD)
                // data.data = [{ resolution: "720p (HD)", url: "..." }, { resolution: "360p (SD)", url: "..." }]
                
                let videoUrl = null;
                const bestRes = data.data.find(x => x.resolution && x.resolution.includes('HD'));
                const fallbackRes = data.data.find(x => x.resolution && x.resolution.includes('SD'));
                
                videoUrl = (bestRes || fallbackRes || data.data[0]).url;

                if (!videoUrl) return msg.reply("❌ Video FB tidak ditemukan.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                    caption: `💙 *Facebook Video*`
                });

            } catch (e) {
                console.error("FB Error:", e);
                await msg.reply("❌ Gagal FB (Coba kirim link video aslinya, jangan link share).");
            }
            return true;
        }

        // --- 3. INSTAGRAM (INSTAGRAM-URL-DIRECT) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            try {
                const data = await instagramDl(url);
                
                // Output library ini: { results_number: 1, url_list: [ 'url1', 'url2' ] }
                if (!data.url_list || data.url_list.length === 0) return msg.reply("❌ IG Gagal (Private/Login).");

                for (let i = 0; i < Math.min(data.url_list.length, 5); i++) {
                     await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.url_list[i], { unsafeMime: true }));
                }
            } catch (e) { 
                console.error("IG Error:", e);
                await msg.reply("❌ Gagal IG."); 
            }
            return true;
        }

        // --- 4. YOUTUBE (YTDL-CORE) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
             await msg.react('⏳');
             try {
                const info = await ytdl.getInfo(url);
                // Pilih format video+audio (mp4) yang ada
                const format = ytdl.chooseFormat(info.formats, { quality: '18' }); // quality 18 biasanya 360p (aman buat WA)
                
                if (!format || !format.url) return msg.reply("❌ Gagal parsing YT.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(format.url, { unsafeMime: true }), { 
                    caption: `📺 *${info.videoDetails.title}*` 
                });
             } catch (e) { 
                 console.error("YT Error:", e);
                 await msg.reply("❌ Gagal YT (Mungkin proteksi IP)."); 
             }
             return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader System Error:", error);
        return false;
    }
};

// Fungsi Helper Expand URL
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
        { command: '(Auto Detect)', desc: 'DL Sosmed (Avengers)' }
    ]
};