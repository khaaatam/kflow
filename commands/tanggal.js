const db = require('../lib/database');
const logger = require('../lib/logger');
const react = require('../lib/react');
const config = require('../config');

const TABLE = 'important_dates';

async function ensureTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nama VARCHAR(100) NOT NULL,
            tanggal DATE NOT NULL,
            tipe ENUM('ultah', 'hari_jadi', 'lainnya') DEFAULT 'lainnya',
            pesan TEXT,
            created_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

module.exports = async (client, msg, args, _senderId, namaPengirim) => {
    await ensureTable();

    const sub = args[1];

    // --- TAMBAH ---
    if (sub === 'tambah' || sub === 'add') {
        const tanggalStr = args[2];
        const tipe = args[3] || 'lainnya';
        const nama = args[4] || namaPengirim;
        const pesan = args.slice(5).join(' ').trim();

        if (!tanggalStr) return msg.reply('Format: `!tanggal tambah YYYY-MM-DD [ultah/hari_jadi/lainnya] [nama] [pesan]`');

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(tanggalStr)) return msg.reply('Format tanggal: YYYY-MM-DD (contoh: 1998-05-05)');

        const validTypes = ['ultah', 'hari_jadi', 'lainnya'];
        if (!validTypes.includes(tipe)) return msg.reply(`Tipe: ${validTypes.join(', ')}`);

        try {
            await db.query(
                `INSERT INTO ${TABLE} (nama, tanggal, tipe, pesan, created_by) VALUES (?, ?, ?, ?, ?)`,
                [nama, tanggalStr, tipe, pesan || null, namaPengirim]
            );
            await react(msg, '✅');
            return msg.reply(`✅ Tanggal *${tanggalStr}* (${tipe}) buat *${nama}* berhasil disimpan!`);
        } catch (e) {
            logger.error('Date Add Error:', e.message);
            return msg.reply('❌ Gagal simpan tanggal.');
        }
    }

    // --- LIST ---
    if (!sub || sub === 'list' || sub === 'lihat') {
        const [rows] = await db.query(
            `SELECT id, nama, tanggal, tipe, pesan, DATE_FORMAT(tanggal, '%d %M %Y') as formatted FROM ${TABLE} ORDER BY MONTH(tanggal), DAY(tanggal)`
        );
        if (!rows.length) return msg.reply('📭 Belum ada tanggal tersimpan.\nKetik `!tanggal tambah` buat nambah.');

        const lines = rows.map((r, i) => {
            const typeEmoji = r.tipe === 'ultah' ? '🎂' : r.tipe === 'hari_jadi' ? '💕' : '📅';
            const daysUntil = getDaysUntil(r.tanggal);
            const countdown = daysUntil === 0 ? ' ← *HARI INI!*' : daysUntil > 0 ? ` (${daysUntil} hari lagi)` : ` (${Math.abs(daysUntil)} hari lalu)`;
            return `${i + 1}. ${typeEmoji} *${r.nama}* — ${r.formatted}${countdown}`;
        });

        return msg.reply(`📅 *TANGGAL PENTING* (${rows.length})\n\n${lines.join('\n')}\n\nGunakan \`!tanggal hapus <id>\` buat hapus.`);
    }

    // --- HAPUS ---
    if (sub === 'hapus' || sub === 'del') {
        const id = parseInt(args[2]);
        if (isNaN(id)) return msg.reply('ID mana? Cek `!tanggal list` dulu.');

        const [rows] = await db.query(`SELECT id, nama FROM ${TABLE} WHERE id = ?`, [id]);
        if (!rows.length) return msg.reply('❌ Tanggal gak ditemukan.');

        await db.query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
        await react(msg, '✅');
        return msg.reply(`🗑️ Tanggal *"${rows[0].nama}"* (ID:${id}) dihapus.`);
    }

    // --- HELP ---
    return msg.reply(
        '📅 *TANGGAL PENTING*\n\n' +
        '• `!tanggal tambah YYYY-MM-DD [tipe] [nama] [pesan]` — Simpan tanggal\n' +
        '• `!tanggal list` — Lihat semua tanggal\n' +
        '• `!tanggal hapus <id>` — Hapus tanggal\n\n' +
        'Tipe: `ultah`, `hari_jadi`, `lainnya`'
    );
};

function getDaysUntil(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const thisYear = new Date(now.getFullYear(), date.getMonth(), date.getDate());
    const diff = thisYear.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

module.exports.checkUpcoming = async (client) => {
    try {
        await ensureTable();
        const [rows] = await db.query(
            `SELECT nama, tanggal, tipe, pesan FROM ${TABLE}`
        );

        const now = new Date();
        for (const row of rows) {
            const date = new Date(row.tanggal);
            const thisYear = new Date(now.getFullYear(), date.getMonth(), date.getDate());
            const diffDays = Math.ceil((thisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 7 || diffDays === 1 || diffDays === 0) {
                const target = config.system.logNumber;
                if (!target) continue;

                const { resolveId } = require('../lib/lid');
                const targetId = resolveId(target);

                let msg;
                if (diffDays === 0) {
                    const emoji = row.tipe === 'ultah' ? '🎂' : row.tipe === 'hari_jadi' ? '💕' : '📅';
                    msg = `${emoji} *Hari ini ${row.tipe === 'ultah' ? 'ultah' : row.tipe === 'hari_jadi' ? 'hari jadi' : 'tanggal spesial'} ${row.nama}!*`;
                    if (row.pesan) msg += `\n${row.pesan}`;
                } else if (diffDays === 1) {
                    msg = `⏰ Besok adalah ${row.tipe} ${row.nama}! Jangan lupa ya.`;
                } else {
                    msg = `📅 ${row.nama} ${row.tipe} 7 hari lagi (${diffDays === 7 ? ' minggu depan' : ''})`;
                }

                await client.sendMessage(targetId, msg);
                logger.info(`[DATE CHECK] Sent reminder: ${row.nama} (${diffDays} days)`);
            }
        }
    } catch (e) {
        logger.error('Date Check Error:', e.message);
    }
};

module.exports.metadata = {
    category: 'LAINNYA',
    commands: [{ command: '!tanggal', desc: 'Kelola tanggal penting (ultah/hari jadi)' }],
};
