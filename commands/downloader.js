const config = require('../config');
const { tiktok, instagram, youtube, facebook } = require('btch-downloader');

module.exports = async (client, msg, text) => {
    try {
        // Cek apakah pesan berisi URL?
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);

        // Kalau gak ada link, skip
        if (!match) return false;

        const url = match[0];

        // --- 1. TIKTOK DOWNLOADER ---
        if (url.includes('tiktok.com')) {
            await msg.react('⏳');
            const data = await tiktok(url);

            if (!data.url && !data.video) return msg.reply("❌ Gagal ambil video TikTok.");

            // Prioritas: Video No Watermark -> Video Original
            const videoUrl = data.url || data.video || data.nowm;

            await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                caption: `🎵 *TikTok Downloader*\nAuthor: ${data.nickname || '-'}\nDesc: ${data.title || '-'}`
            });
            return true;
        }

        // --- 2. INSTAGRAM DOWNLOADER (Reels/Post) ---
        if (url.includes('instagram.com')) {
            await msg.react('⏳');
            const data = await instagram(url);

            if (!data || data.length === 0) return msg.reply("❌ Gagal. Pastikan akun tidak di-private.");

            // IG bisa multiple slide, kita ambil semua (max 5 biar gak spam)
            for (let i = 0; i < Math.min(data.length, 5); i++) {
                const mediaUrl = data[i].url;
                await client.sendMessage(msg.from, await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true }));
            }
            return true;
        }

        // --- 3. FACEBOOK DOWNLOADER ---
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            const data = await facebook(url);

            if (!data) return msg.reply("❌ Gagal ambil video FB.");

            // Ambil kualitas HD dulu, kalau gak ada baru SD
            const videoUrl = data.hd || data.sd;

            await client.sendMessage(msg.from, await MessageMedia.fromUrl(videoUrl, { unsafeMime: true }), {
                caption: `💙 *Facebook Downloader*`
            });
            return true;
        }

        // --- 4. YOUTUBE DOWNLOADER (Shorts/Video) ---
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await msg.react('⏳');
            const data = await youtube(url);

            if (!data || !data.mp4) return msg.reply("❌ Gagal ambil video YT.");

            // Cek size dulu, WA nolak file > 100MB biasanya
            await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.mp4, { unsafeMime: true }), {
                caption: `📺 *YouTube Downloader*\nJudul: ${data.title}`
            });
            return true;
        }

        return false;

    } catch (error) {
        console.error("Downloader Error:", error);
        // Jangan reply error ke user biar gak spam kalau dia kirim link biasa
        return false;
    }
};

// Helper buat download file dari URL (Karena WA Web JS butuh MessageMedia)
const { MessageMedia } = require('whatsapp-web.js');

module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '(Auto Detect URL)', desc: 'Download TikTok/IG/FB/YT' }
    ]
};