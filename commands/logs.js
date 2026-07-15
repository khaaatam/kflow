const db = require('../lib/database');
const logger = require('../lib/logger');
const react = require('../lib/react');

module.exports = async (client, msg, args) => {
    await react(msg, '⏳');
    try {
        let limit = 20;
        let where = [];
        let params = [];

        for (const arg of args) {
            if (/^\d+$/.test(arg)) {
                limit = Math.min(Number(arg), 200);
            } else if (arg.toLowerCase().startsWith('nama:')) {
                where.push('nama_pengirim LIKE ?');
                params.push(`%${arg.slice(5)}%`);
            } else if (arg.toLowerCase().startsWith('keyword:')) {
                where.push('pesan LIKE ?');
                params.push(`%${arg.slice(8)}%`);
            }
        }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const sql = `SELECT nama_pengirim, pesan, DATE_FORMAT(created_at, '%d/%m %H:%i') as waktu FROM full_chat_logs ${whereClause} ORDER BY id DESC LIMIT ?`;

        const [rows] = await db.query(sql, [...params, limit]);
        if (!rows.length) {
            await react(msg, '✅');
            return client.sendMessage(msg.from, '📭 *KOSONG*\nGak ada chat logs.');
        }

        rows.reverse();
        const lines = rows.map((r, i) => `${i + 1}. [${r.waktu}] *${r.nama_pengirim}*: ${r.pesan}`);
        const header = `📋 *CHAT LOGS* (${rows.length} messages)\n\n`;
        await react(msg, '✅');
        client.sendMessage(msg.from, header + lines.join('\n'));
    } catch (e) {
        logger.error('Logs Error:', e);
        msg.reply('❌ Gagal ambil chat logs.');
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [
        { command: '!logs', desc: 'Lihat Chat Logs (args: limit/nama:/keyword:)' }
    ]
};
