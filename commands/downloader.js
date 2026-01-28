const config = require('../config');
// 👇 INI DIA PERBAIKANNYA (Ganti nama variabel import) 👇
const { ttdl, igdl, youtube, fbdown } = require('btch-downloader');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        const url = match[0];

        // --- 1. TIKTOK DOWNLOADER (Pake ttdl) ---
        if (url.includes('tiktok.com')) {
            await msg.react('⏳');
            const data = await ttdl(url); // 👈 Ganti jadi ttdl

            if (!data.url && !data.video) return msg.reply("❌ Gagal ambil video TikTok.");
            const videoUrl = data.url || data.video || data.nowm;

            await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                caption: `🎵 *TikTok Downloader*\nAuthor: ${data.nickname || '-'}\nDesc: ${data.title || '-'}`
            });
            return true;
        }

        // --- 2. INSTAGRAM DOWNLOADER (Pake igdl) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            const data = await igdl(url); // 👈 Ganti jadi igdl

            if (!data || data.length === 0) return msg.reply("❌ Gagal. Pastikan akun tidak di-private.");

            for (let i = 0; i < Math.min(data.length, 5); i++) {
                const mediaUrl = data[i].url;
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true }));
            }
            return true;
        }

        // --- 3. FACEBOOK DOWNLOADER (Pake fbdown) ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            const data = await fbdown(url); // 👈 Ganti jadi fbdown

            if (!data) return msg.reply("❌ Gagal ambil video FB.");
            const videoUrl = data.hd || data.sd || data.Normal_video || data.HD; // Jaga-jaga nama property beda

            if (!videoUrl) return msg.reply("❌ Video tidak ditemukan/private.");

            await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                caption: `💙 *Facebook Downloader*`
            });
            return true;
        }

        // --- 4. YOUTUBE DOWNLOADER (Tetap youtube) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            const data = await youtube(url);

            if (!data || !data.mp4) return msg.reply("❌ Gagal ambil video YT.");

            await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4, { unsafeMime: true }), {
                caption: `📺 *YouTube Downloader*\nJudul: ${data.title}`
            });
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader Error:", error);
        return false;
    }
};

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect URL)', desc: 'Download TikTok/IG/FB/YT' }
    ]
};