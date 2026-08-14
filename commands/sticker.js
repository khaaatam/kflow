/* global Buffer */
const fs = require('fs');
const sharp = require('@img/sharp-wasm32');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('../lib/logger');
const react = require('../lib/react');
const downloadMedia = require('../lib/downloadMedia');
const { tempPath, cleanupFiles } = require('../lib/tempUtils');
const ffmpeg = require('fluent-ffmpeg');
const db = require('../lib/database');

const toWebp = (inputPath, outputPath) => new Promise((resolve, reject) => {
    ffmpeg(inputPath)
        .outputOptions([
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
            '-vcodec', 'libwebp', '-lossless', '0', '-compression_level', '6',
            '-q:v', '50', '-loop', '0', '-preset', 'default', '-an', '-vsync', '0'
        ])
        .toFormat('webp')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
});

const SHAPES = {
    circle: (size) => `<svg width="${size}" height="${size}"><defs><clipPath id="c"><circle cx="${size/2}" cy="${size/2}" r="${size/2}"/></clipPath></defs><rect width="${size}" height="${size}" clip-path="url(#c)"/></svg>`,
    rounded: (size) => `<svg width="${size}" height="${size}"><defs><clipPath id="r"><rect x="0" y="0" width="${size}" height="${size}" rx="${size/8}" ry="${size/8}"/></clipPath></defs><rect width="${size}" height="${size}" clip-path="url(#r)"/></svg>`,
    crop: (size) => `<svg width="${size}" height="${size}"><defs><clipPath id="cp"><rect x="${size*0.05}" y="${size*0.05}" width="${size*0.9}" height="${size*0.9}"/></clipPath></defs><rect width="${size}" height="${size}" clip-path="url(#cp)"/></svg>`,
};

module.exports = async (client, msg, args) => {
    const sub = args[1];

    // --- ADD STICKER: !sticker add <nama> (reply/kirim gambar) ---
    if (sub === 'add' || sub === 'simpan') {
        const nama = args.slice(2).join(' ').trim();
        if (!nama) return msg.reply('Nama sticker-nya apa?\nContoh: `!sticker add lucu`');

        const isMedia = msg.hasMedia;
        const isQuotedMedia = msg.hasQuotedMsg && (await msg.getQuotedMessage()).hasMedia;

        if (!isMedia && !isQuotedMedia) {
            return msg.reply('Reply/kirim gambar dengan caption `!sticker add <nama>`');
        }

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

            await db.query(
                'INSERT INTO sticker_packs (nama, webp_data, mimetype, created_by) VALUES (?, ?, ?, ?)',
                [nama, webpBuffer, 'image/webp', msg.author || msg.from]
            );

            await react(msg, '✅');
            await msg.reply(`✅ Sticker *"${nama}"* berhasil disimpan!`);
        } catch (e) {
            logger.error('Sticker Pack Add Error:', e.message || e);
            await react(msg, '❌');
            await msg.reply('❌ Gagal simpan sticker.');
        }
        return;
    }

    // --- LIST STICKERS: !sticker list ---
    if (sub === 'list' || sub === 'lihat') {
        const [rows] = await db.query(
            'SELECT id, nama, created_by, DATE_FORMAT(created_at, "%d/%m %H:%i") as waktu FROM sticker_packs ORDER BY id DESC LIMIT 50'
        );
        if (!rows.length) return msg.reply('📭 Belum ada sticker tersimpan.\nKetik `!sticker add <nama>` buat simpan.');
        const lines = rows.map((r, i) => `${i + 1}. [${r.id}] *${r.nama}* — ${r.waktu}`);
        return msg.reply(`🎨 *STICKER PACK* (${rows.length})\n\n${lines.join('\n')}\n\nKetik *!sticker <id/nama>* buat kirim.`);
    }

    // --- DELETE STICKER: !sticker hapus <id> ---
    if (sub === 'hapus' || sub === 'del') {
        const id = parseInt(args[2]);
        if (isNaN(id)) return msg.reply('ID mana? Cek `!sticker list` dulu.');
        const [rows] = await db.query('SELECT id, nama FROM sticker_packs WHERE id = ?', [id]);
        if (!rows.length) return msg.reply('❌ Sticker gak ditemukan.');
        await db.query('DELETE FROM sticker_packs WHERE id = ?', [id]);
        await react(msg, '✅');
        return msg.reply(`🗑️ Sticker *"${rows[0].nama}"* (ID:${id}) dihapus.`);
    }

    // --- SEND STICKER FROM PACK: !sticker <id/nama> ---
    if (sub && !isNaN(parseInt(sub))) {
        const [rows] = await db.query('SELECT webp_data, mimetype FROM sticker_packs WHERE id = ?', [parseInt(sub)]);
        if (!rows.length) return msg.reply('❌ Sticker gak ditemukan.');
        try {
            const sticker = rows[0];
            const media = new MessageMedia(sticker.mimetype, sticker.webp_data.toString('base64'));
            await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'K-Flow Bot', stickerName: 'Sticker Pack' });
        } catch (e) {
            logger.error('Sticker Pack Send Error:', e.message);
            await msg.reply('❌ Gagal kirim sticker.');
        }
        return;
    }

    if (sub) {
        // Search by name
        const [rows] = await db.query('SELECT id, nama, webp_data, mimetype FROM sticker_packs WHERE nama LIKE ? ORDER BY id DESC LIMIT 1', [`%${sub}%`]);
        if (!rows.length) return msg.reply('❌ Sticker gak ditemukan.');
        try {
            const sticker = rows[0];
            const media = new MessageMedia(sticker.mimetype, sticker.webp_data.toString('base64'));
            await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'K-Flow Bot', stickerName: sticker.nama });
        } catch (e) {
            logger.error('Sticker Pack Send Error:', e.message);
            await msg.reply('❌ Gagal kirim sticker.');
        }
        return;
    }

    // --- CONVERT IMAGE TO STICKER: !sticker (with image, no subcommand) ---
    if (msg.hasMedia) {
        try {
            await react(msg, '⏳');
            const media = await downloadMedia(msg);
            if (!media) {
                await react(msg, '❌');
                return msg.reply('❌ Gagal download media.');
            }

            if (media.mimetype?.includes('webp')) {
                await msg.reply(media, undefined, { sendMediaAsSticker: true, stickerAuthor: 'ig: @khataaam_', stickerName: 'JikaeL the Creator' });
                await react(msg, '✅');
                return;
            }

            // Parse effects from args (skip !sticker itself)
            const effects = args.slice(1).map(a => a.toLowerCase());
            const hasShape = effects.find(e => SHAPES[e]);
            const hasNegate = effects.includes('negate');
            const hasGrayscale = effects.includes('grayscale');
            const blurVal = effects.find(e => e.startsWith('blur='));
            const bgVal = effects.find(e => e.startsWith('bg='));
            const textVal = effects.find(e => e.startsWith('text='));
            const brightnessVal = effects.find(e => e.startsWith('brightness='));
            const saturationVal = effects.find(e => e.startsWith('saturation='));

            const hasEffects = hasShape || hasNegate || hasGrayscale || blurVal || bgVal || textVal || brightnessVal || saturationVal;

            if (hasEffects) {
                // Sharp-based processing
                const imgBuffer = Buffer.from(media.data, 'base64');
                const size = 512;
                let image = sharp(imgBuffer).resize(size, size, { fit: 'cover' });

                if (hasNegate) image = image.negate();
                if (hasGrayscale) image = image.grayscale();
                if (blurVal) image = image.blur(Math.min(Math.max(Number(blurVal.split('=')[1]), 0.3), 1000));
                if (brightnessVal) image = image.modulate({ brightness: Number(brightnessVal.split('=')[1]) || 1 });
                if (saturationVal) image = image.modulate({ saturation: Number(saturationVal.split('=')[1]) || 1 });

                // Background color
                if (bgVal) {
                    const color = bgVal.split('=')[1] || 'white';
                    const svgBg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${color}"/></svg>`;
                    image = image.composite([{ input: Buffer.from(svgBg), blend: 'dest-over' }]);
                }

                // Shape mask
                if (hasShape) {
                    const maskSvg = SHAPES[hasShape](size);
                    image = image.composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }]);
                }

                // Text overlay
                if (textVal) {
                    const text = textVal.split('=').slice(1).join('=').replace(/['"]/g, '');
                    const svgText = `<svg width="${size}" height="${size}"><style>text { font-family: Impact, Arial, sans-serif; font-size: 48px; fill: white; text-anchor: middle; paint-order: stroke; stroke: black; stroke-width: 3px; }</style><text x="50%" y="50%">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text></svg>`;
                    image = image.composite([{ input: Buffer.from(svgText) }]);
                }

                const webpBuffer = await image.webp({ quality: 80 }).toBuffer();
                const webpMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));
                await msg.reply(webpMedia, undefined, { sendMediaAsSticker: true, stickerAuthor: 'ig: @khataaam_', stickerName: 'JikaeL the Creator' });
            } else {
                // Default ffmpeg processing
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

    // --- HELP ---
    await msg.reply(
        '🎨 *STICKER*\n\n' +
        '• `!sticker` (kirim gambar) — Convert ke stiker\n' +
        '• `!sticker add <nama>` — Simpan ke pack\n' +
        '• `!sticker list` — Lihat semua sticker\n' +
        '• `!sticker <id/nama>` — Kirim sticker\n' +
        '• `!sticker hapus <id>` — Hapus sticker\n\n' +
        '*Effects:*\n' +
        '• `!sticker circle` — Bulat\n' +
        '• `!sticker rounded` — Bulat sudut\n' +
        '• `!sticker crop` — Crop pinggir\n' +
        '• `!sticker negate` — Invert warna\n' +
        '• `!sticker grayscale` — B&W\n' +
        '• `!sticker blur=5` — Blur\n' +
        '• `!sticker bg=red` — Background merah\n' +
        '• `!sticker text=halo` — Tambah teks\n' +
        '• `!sticker brightness=1.5` — Terang\n' +
        '• `!sticker saturation=2` — Saturated\n\n' +
        'Gabungkan: `!sticker circle text=halo bg=blue`'
    );
};

module.exports.metadata = {
    category: 'MEDIA',
    commands: [{ command: '!sticker', desc: 'Bikin/kirim stiker', isPublic: true }]
};
