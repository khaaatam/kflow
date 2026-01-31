const axios = require('axios');
const { getFbVideoInfo } = require('fb-downloader-scrapper');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = async (client, msg, args, senderId, namaPengirim, text) => {
    try {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = text.match(urlRegex);
        if (!match) return false;

        let url = match[0];

        // TIKTOK
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

        // FACEBOOK
        if (url.includes('facebook.com') || url.includes('fb.watch')) {
            await msg.react('⏳');
            try {
                if (url.includes('share') || url.includes('/r/') || url.includes('fb.watch')) {
                    try {
                        const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                        url = resp.request.res.responseUrl || url;
                    } catch (e) { }
                }
                const data = await getFbVideoInfo(url);
                if (!data) return msg.reply("❌ Gagal FB.");

                await client.sendMessage(msg.from, await MessageMedia.fromUrl(data.hd || data.sd, { unsafeMime: true }), {
                    caption: `💙 *FB Video*`
                });
            } catch (e) { await msg.reply("❌ Error FB."); }
            return true;
        }
    } catch (e) { console.error(e); }
};
module.exports.metadata = {
    category: "DOWNLOADER",
    commands: [
        { command: '!fb', desc: 'Download FB' },
        { command: '!tt', desc: 'Download TikTok' },
        { command: '(auto detect)', desc: 'Auto DL Link' } // Ini penting buat Handler
    ]
};