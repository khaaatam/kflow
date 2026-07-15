/* global Buffer */
const db = require('../lib/database');
const logger = require('../lib/logger');
const react = require('../lib/react');
const { MessageMedia } = require('whatsapp-web.js');

const toCSV = (rows) => {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','));
    }
    return lines.join('\n');
};

const sendCSV = async (msg, csv, filename) => {
    const buffer = Buffer.from(csv, 'utf8');
    const media = new MessageMedia('text/csv', buffer.toString('base64'), filename);
    await msg.reply(media, undefined, { filename });
};

module.exports = async (client, msg, args, _senderId) => {
    const sub = args[1];

    if (sub === 'chat') {
        await react(msg, '⏳');
        try {
            const [rows] = await db.query(
                "SELECT id, nama_pengirim, pesan, is_forwarded, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as waktu FROM full_chat_logs ORDER BY id ASC"
            );
            if (!rows.length) return msg.reply('📭 Gak ada data chat.');

            const csv = toCSV(rows);
            await sendCSV(msg, csv, `chat_logs_${Date.now()}.csv`);
            await react(msg, '✅');
            await msg.reply(`✅ *${rows.length}* chat logs exported.`);
        } catch (e) {
            logger.error('Export chat error:', e);
            await msg.reply('❌ Gagal export chat logs.');
        }
        return;
    }

    if (sub === 'finance') {
        await react(msg, '⏳');
        try {
            const [rows] = await db.query(
                "SELECT id, user_id, jenis, nominal, keterangan, sumber, DATE_FORMAT(tanggal, '%Y-%m-%d %H:%i:%s') as waktu FROM transaksi ORDER BY id ASC"
            );
            if (!rows.length) return msg.reply('📭 Gak ada data transaksi.');

            const csv = toCSV(rows);
            await sendCSV(msg, csv, `finance_${Date.now()}.csv`);
            await react(msg, '✅');
            await msg.reply(`✅ *${rows.length}* transaksi exported.`);
        } catch (e) {
            logger.error('Export finance error:', e);
            await msg.reply('❌ Gagal export data keuangan.');
        }
        return;
    }

    if (sub === 'memory') {
        await react(msg, '⏳');
        try {
            const [rows] = await db.query(
                "SELECT id, user, fakta, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as waktu FROM memori ORDER BY id ASC"
            );
            if (!rows.length) return msg.reply('📭 Gak ada data memori.');

            const csv = toCSV(rows);
            await sendCSV(msg, csv, `memori_${Date.now()}.csv`);
            await react(msg, '✅');
            await msg.reply(`✅ *${rows.length}* memori exported.`);
        } catch (e) {
            logger.error('Export memory error:', e);
            await msg.reply('❌ Gagal export memori.');
        }
        return;
    }

    await msg.reply(
        '📦 *EXPORT DATA*\n\n' +
        '• `!export chat` — Export chat logs (CSV)\n' +
        '• `!export finance` — Export transaksi (CSV)\n' +
        '• `!export memory` — Export memori AI (CSV)'
    );
};

module.exports.metadata = {
    category: 'SYSTEM',
    commands: [
        { command: '!export', desc: 'Export data (chat/finance/memory)' }
    ]
};
