/* global Buffer */
const fs = require('fs');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');
const ffmpeg = require('fluent-ffmpeg');

const DEFAULT_VF = 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512';
const toWebp = (inputPath, outputPath, vf = DEFAULT_VF) => new Promise((resolve, reject) => {
    ffmpeg(inputPath)
        .outputOptions([
            '-vf', vf,
            '-vcodec', 'libwebp', '-lossless', '0', '-compression_level', '6',
            '-q:v', '50', '-loop', '0', '-preset', 'default', '-an', '-vsync', '0'
        ])
        .toFormat('webp')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
});

module.exports = async (client, msg, args) => {
    const sub = args[1];

    if (sub === 'add' || sub === 'simpan') {
        const nama = args.slice(2).join(' ').trim();
        if (!nama) return msg.reply('Nama sticker-nya apa?\nContoh: `!sticker add lucu`');
        const isMedia = msg.hasMedia;
        const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;
        if (!isMedia && !isQuotedMedia) return msg.reply('Reply/kirim gambar dengan caption `!sticker add <nama>`');
        await react(msg, '⏳');
        try {
            const targetMsg = isMedia ? msg : await msg.getQuotedMessage();
            const media = await downloadMedia(targetMsg);
            if (!media) return msg.reply('❌ Gagal download media.');
            let webpBuffer;
            if (media.mimetype?.includes('webp')) {
                webpBuffer = Buffer.from(media.data, 'base64');
            } else {
                const ext = media.mimetype?.includes('png') ? 'png' : 'jpg';
                const inputPath = tempPath('stkpack_in', ext);
                const outputPath = tempPath('stkpack_out', 'webp');
                fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));
                await toWebp(inputPath, outputPath);
                webpBuffer = fs.readFileSync(outputPath);
                cleanupFiles(inputPath, outputPath);
            }
            const db = require('../lib/database');
            await db.query('INSERT INTO sticker_packs (nama, webp_data, mimetype, created_by) VALUES (?, ?, ?, ?)', [nama, webpBuffer, 'image/webp', msg.author || msg.from]);
            await react(msg, '✅');
            await msg.reply(`✅ Sticker *"${nama}"* berhasil disimpan!`);
        } catch (e) {
            logger.error('Sticker Pack Add Error:', e.message || e);
            await react(msg, '❌');
            await msg.reply('❌ Gagal simpan sticker.');
        }
        return;
    }

    if (sub === 'list' || sub === 'lihat') {
        const db = require('../lib/database');
        const [rows] = await db.query('SELECT id, nama, created_by, DATE_FORMAT(created_at, "%d/%m %H:%i") as waktu FROM sticker_packs ORDER BY id DESC LIMIT 50');
        if (!rows.length) return msg.reply('📭 Belum ada sticker tersimpan.\nKetik `!sticker add <nama>` buat simpan.');
        const lines = rows.map((r, i) => `${i + 1}. [${r.id}] *${r.nama}* — ${r.waktu}`);
        return msg.reply(`🎨 *STICKER PACK* (${rows.length})\n\n${lines.join('\n')}\n\nKetik *!sticker <id/nama>* buat kirim.`);
    }

    if (sub === 'hapus' || sub === 'del') {
        const db = require('../lib/database');
        const id = parseInt(args[2]);
        if (isNaN(id)) return msg.reply('ID mana? Cek `!sticker list` dulu.');
        const [rows] = await db.query('SELECT id, nama FROM sticker_packs WHERE id = ?', [id]);
        if (!rows.length) return msg.reply('❌ Sticker gak ditemukan.');
        await db.query('DELETE FROM sticker_packs WHERE id = ?', [id]);
        await react(msg, '✅');
        return msg.reply(`🗑️ Sticker *"${rows[0].nama}"* (ID:${id}) dihapus.`);
    }

    if (sub && !isNaN(parseInt(sub))) {
        const db = require('../lib/database');
        const [rows] = await db.query('SELECT webp_data, mimetype FROM sticker_packs WHERE id = ?', [parseInt(sub)]);
        if (!rows.length) return msg.reply('❌ Sticker gak ditemukan.');
        try {
            const sticker = rows[0];
            const media = new MessageMedia(sticker.mimetype, sticker.webp_data.toString('base64'));
            await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'K-Flow Bot', stickerName: 'Sticker Pack' });
        } catch (e) { logger.error('Sticker Pack Send Error:', e.message); await msg.reply('❌ Gagal kirim sticker.'); }
        return;
    }

    // Meme-text mode: !sticker teks atas;teks bawah (kirim/reply gambar).
    // Cek di sini (sebelum lookup nama pack) supaya teks ber-`;` tidak
    // dikira nama sticker pack. Teks digambar via ffmpeg drawtext (font Impact
    // putih stroke hitam) — BUKAN via SVG/resvg, karena resvg ngerender teks
    // jadi blank di Termux (terbukti di !meme).
    const memeInput = args.slice(1).join(' ');
    if (memeInput.includes(';')) {
        const parts = memeInput.split(';').map(s => s.trim().toUpperCase());
        const topText = parts[0] || '';
        const bottomText = parts[1] || '';
        if (!topText && !bottomText) return msg.reply('Contoh: `!sticker teks atas;teks bawah` (kirim/reply gambar)');
        const isMedia = msg.hasMedia;
        const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;
        if (!isMedia && !isQuotedMedia) return msg.reply('Kirim/reply gambar dengan caption `!sticker atas;bawah`');
        await react(msg, '⏳');
        try {
            const { FONT_PATH } = require('../lib/mediaEffects');
            const targetMsg = isMedia ? msg : await msg.getQuotedMessage();
            const media = await downloadMedia(targetMsg);
            if (!media) { await react(msg, '❌'); return msg.reply('❌ Gagal download media.'); }
            // Escape khusus parser filter ffmpeg (argumen dilempar langsung
            // tanpa shell, jadi cukup backslash + kutip satu).
            const escapeDrawtext = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            // Normalisasi path font (Windows `C:\...` → lolos parser filter).
            const fontFile = FONT_PATH.replace(/\\/g, '/').replace(/:/g, '\\:');
            const maxLen = Math.max(topText.length, bottomText.length, 1);
            const fontSize = Math.max(28, Math.min(48, Math.floor(560 / maxLen)));
            const drawBase = `fontfile='${fontFile}':fontcolor=white:fontsize=${fontSize}:borderw=3:bordercolor=black:x=(w-text_w)/2`;
            const vfParts = [DEFAULT_VF];
            if (topText) vfParts.push(`drawtext=${drawBase}:text='${escapeDrawtext(topText)}':y=20`);
            if (bottomText) vfParts.push(`drawtext=${drawBase}:text='${escapeDrawtext(bottomText)}':y=h-text_h-20`);
            const inputPath = tempPath('stk_meme_in', 'jpg');
            const outputPath = tempPath('stk_out', 'webp');
            fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));
            await toWebp(inputPath, outputPath, vfParts.join(','));
            const webpMedia = MessageMedia.fromFilePath(outputPath);
            await msg.reply(webpMedia, undefined, { sendMediaAsSticker: true, stickerAuthor: 'ig: @khataaam_', stickerName: 'JikaeL the Creator' });
            cleanupFiles(inputPath, outputPath);
            await react(msg, '✅');
        } catch (e) {
            logger.error('Sticker Meme Error:', e.message || e);
            await react(msg, '❌');
            await msg.reply('❌ Gagal bikin stiker meme.');
        }
        return;
    }

    if (sub) {
        const db = require('../lib/database');
        const [rows] = await db.query('SELECT id, nama, webp_data, mimetype FROM sticker_packs WHERE nama LIKE ? ORDER BY id DESC LIMIT 1', [`%${sub}%`]);
        if (!rows.length) return msg.reply('❌ Sticker gak ditemukan.');
        try {
            const sticker = rows[0];
            const media = new MessageMedia(sticker.mimetype, sticker.webp_data.toString('base64'));
            await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'K-Flow Bot', stickerName: sticker.nama });
        } catch (e) { logger.error('Sticker Pack Send Error:', e.message); await msg.reply('❌ Gagal kirim sticker.'); }
        return;
    }

    // Convert polos: dukung media langsung MAUPUN reply gambar
    // (sebelumnya reply jatuh ke menu help di bawah).
    const isDirectMedia = msg.hasMedia;
    const isQuotedMedia = !isDirectMedia && msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;
    if (isDirectMedia || isQuotedMedia) {
        try {
            await react(msg, '⏳');
            const targetMsg = isDirectMedia ? msg : await msg.getQuotedMessage();
            const media = await downloadMedia(targetMsg);
            if (!media) { await react(msg, '❌'); return msg.reply('❌ Gagal download media.'); }

            if (media.mimetype?.includes('webp')) {
                await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'ig: @khataaam_', stickerName: 'JikaeL the Creator' });
                await react(msg, '✅');
                return;
            }

            const effects = args.slice(1).map(a => a.toLowerCase());
            const hasNegate = effects.includes('negate');
            const hasGrayscale = effects.includes('grayscale');
            const blurVal = effects.find(e => e.startsWith('blur='));
            const brightnessVal = effects.find(e => e.startsWith('brightness='));
            const saturationVal = effects.find(e => e.startsWith('saturation='));

            if (hasNegate || hasGrayscale || blurVal || brightnessVal || saturationVal) {
                const { applyEffects } = require('../lib/mediaEffects');
                const imgBuffer = Buffer.from(media.data, 'base64');
                const webpBuf = await applyEffects(imgBuffer, {
                    negate: hasNegate,
                    grayscale: hasGrayscale,
                    blur: blurVal ? Number(blurVal.split('=')[1]) : undefined,
                    brightness: brightnessVal ? Number(brightnessVal.split('=')[1]) : undefined,
                    saturation: saturationVal ? Number(saturationVal.split('=')[1]) : undefined,
                });
                const webpMedia = new MessageMedia('image/webp', webpBuf.toString('base64'));
                await msg.reply(webpMedia, undefined, { sendMediaAsSticker: true, stickerAuthor: 'ig: @khataaam_', stickerName: 'JikaeL the Creator' });
            } else {
                const ext = media.mimetype?.includes('png') ? 'png' : 'jpg';
                const inputPath = tempPath('stk_in', ext);
                const outputPath = tempPath('stk_out', 'webp');
                fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));
                await toWebp(inputPath, outputPath);
                const webpMedia = MessageMedia.fromFilePath(outputPath);
                await msg.reply(webpMedia, undefined, { sendMediaAsSticker: true, stickerAuthor: 'ig: @khataaam_', stickerName: 'JikaeL the Creator' });
                cleanupFiles(inputPath, outputPath);
            }
            await react(msg, '✅');
        } catch (e) {
            logger.error('Sticker Error:', e.message || e);
            await react(msg, '❌');
            await msg.reply('❌ Gagal bikin stiker.');
        }
        return;
    }

    await msg.reply(
        '🎨 *STICKER*\n\n' +
        '• `!sticker` (kirim gambar) — Convert ke stiker\n' +
        '• `!sticker atas;bawah` — Stiker meme (font putih stroke hitam)\n' +
        '• `!sticker add <nama>` — Simpan ke pack\n' +
        '• `!sticker list` — Lihat semua sticker\n' +
        '• `!sticker <id/nama>` — Kirim sticker\n' +
        '• `!sticker hapus <id>` — Hapus sticker\n\n' +
        '*Effects:*\n' +
        '• `!sticker negate` — Invert warna\n' +
        '• `!sticker grayscale` — B&W\n' +
        '• `!sticker blur=5` — Blur\n' +
        '• `!sticker brightness=1.5` — Terang\n' +
        '• `!sticker saturation=2` — Saturated'
    );
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!sticker', desc: 'Bikin/kirim stiker', isPublic: true }]
};
