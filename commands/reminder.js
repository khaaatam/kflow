const db = require('../lib/database');
const logger = require('../lib/logger');
const react = require('../lib/react');
const { OVERDUE_EXPIRY_MINUTES, OVERDUE_STAGGER_MS } = require('../lib/constants');

// --- HELPER: PENJADWAL TUGAS ---
let overdueCounter = 0;
let safetyInterval = null;

const toSQL = (d) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${da} ${h}:${mi}:${s}`;
};

// Hitung waktu berikutnya berdasarkan recurrence
function getNextTime(recurrence, from) {
    const d = new Date(from);
    if (recurrence === 'daily') {
        d.setDate(d.getDate() + 1);
    } else if (recurrence === 'weekly') {
        d.setDate(d.getDate() + 7);
    } else if (recurrence === 'monthly') {
        d.setMonth(d.getMonth() + 1);
    } else {
        return null; // one-shot
    }
    return d;
}

const scheduleJob = (client, id, userId, pesan, waktuEksekusi, recurrence) => {
    const now = Date.now();
    const target = new Date(waktuEksekusi).getTime();
    const delay = target - now;

    logger.info(`[Reminder] ID=${id} now=${new Date(now).toISOString()} target=${new Date(target).toISOString()} delay=${delay}ms`);

    const executeReminder = async (isOverdue, overdueMinutes) => {
        try {
            const [rows] = await db.query('SELECT status FROM reminders WHERE id = ?', [id]);
            if (rows.length === 0 || rows[0].status !== 'pending') {
                logger.info(`[Reminder] ID=${id} skipped (status=${rows[0]?.status})`);
                return;
            }

            const prefix = isOverdue ? `⏰ *REMINDER (TELAT ${overdueMinutes} menit)*: ` : '⏰ *REMINDER*: ';
            const suffix = isOverdue ? '\n_(Maaf tadi bot sempat mati/restart)_' : '';
            await client.sendMessage(userId, `${prefix}${pesan}${suffix}`);

            if (recurrence) {
                const nextTime = getNextTime(recurrence, waktuEksekusi);
                const sqlTime = toSQL(nextTime);
                await db.query(
                    "UPDATE reminders SET waktu_eksekusi = ?, next_time = ? WHERE id = ?",
                    [sqlTime, sqlTime, id]
                );
                scheduleJob(client, id, userId, pesan, nextTime, recurrence);
                logger.info(`Reminder ID ${id} (${recurrence}) dijadwalkan ulang: ${sqlTime}`);
            } else {
                await db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
                logger.info(`Reminder ID ${id} done.`);
            }
        } catch (e) {
            logger.error('Gagal kirim reminder:', e);
        }
    };

    // A. Overdue
    if (delay <= 0) {
        const overdueMinutes = Math.abs(Math.ceil(delay / 1000 / 60));

        if (overdueMinutes > OVERDUE_EXPIRY_MINUTES && !recurrence) {
            logger.info(`Reminder ID ${id} skipped (${overdueMinutes}m telat — expired)`);
            db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
            return;
        }

        const staggerDelay = overdueCounter * OVERDUE_STAGGER_MS;
        overdueCounter++;

        setTimeout(() => executeReminder(true, overdueMinutes), staggerDelay);
        logger.info(`Reminder ID ${id} overdue ${overdueMinutes}m, fires in ${staggerDelay}ms`);
        return;
    }

    // B. On-time
    setTimeout(() => executeReminder(false, 0), delay);
    logger.info(`Reminder ID ${id} scheduled in ${Math.ceil(delay / 1000 / 60)} min (${delay}ms)`);
};

// --- COMMAND UTAMA (!ingetin) ---
module.exports = async (client, msg, args, senderId) => {
    const sub = args[1];

    // --- LIST REMINDERS ---
    if (sub === 'list' || sub === 'lihat') {
        const [rows] = await db.query(
            "SELECT id, pesan, waktu_eksekusi, recurrence, status FROM reminders WHERE user_id = ? AND status = 'pending' ORDER BY waktu_eksekusi ASC",
            [senderId]
        );

        if (rows.length === 0) return msg.reply('📋 Gak ada reminder aktif.');

        const lines = rows.map((r, i) => {
            const tgl = new Date(r.waktu_eksekusi).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            const badge = r.recurrence ? ` 🔄${r.recurrence}` : '';
            return `${i + 1}. [ID:${r.id}] *${r.pesan}*\n   📅 ${tgl}${badge}`;
        });

        return msg.reply(`📋 *REMINDER AKTIF* (${rows.length})\n\n${lines.join('\n\n')}\n\nKetik *!ingetin hapus <ID>* buat hapus.`);
    }

    // --- HAPUS REMINDER ---
    if (sub === 'hapus' || sub === 'del' || sub === 'delete') {
        const id = parseInt(args[2]);
        if (isNaN(id)) return msg.reply('ID mana? Cek `!ingetin list` dulu.');

        const [rows] = await db.query(
            "SELECT id, pesan, status FROM reminders WHERE id = ? AND user_id = ?",
            [id, senderId]
        );

        if (rows.length === 0) return msg.reply('❌ Reminder gak ditemukan atau bukan milik lu.');
        if (rows[0].status !== 'pending') return msg.reply('Reminder itu udah selesai/dihapus.');

        await db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
        await react(msg, '✅');
        return msg.reply(`🗑️ Reminder *"${rows[0].pesan}"* (ID:${id}) dihapus.`);
    }
    let recurrence = null;
    let targetDate = null;
    let pesan = '';

    // Detect recurring: daily/weekly/monthly
    if (['daily', 'weekly', 'monthly'].includes(sub)) {
        recurrence = sub;

        if (sub === 'daily') {
            // !ingetin daily 08.00 absen PBO
            const timeStr = args[2];
            const timeMatch = timeStr && timeStr.match(/^(\d{1,2})[.:](\d{2})$/);
            if (!timeMatch) {
                return msg.reply('Format: `!ingetin daily HH.MM [pesan]`\nContoh: `!ingetin daily 08.00 absen PBO`');
            }
            const [, hour, minute] = timeMatch;
            targetDate = new Date();
            targetDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
            if (targetDate <= new Date()) targetDate.setDate(targetDate.getDate() + 1);
            pesan = args.slice(3).join(' ');
        } else if (sub === 'weekly') {
            // !ingetin weekly jumat 20.00 bayar kos
            const dayNames = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
            const dayStr = (args[2] || '').toLowerCase();
            const dayIndex = dayNames.indexOf(dayStr);
            if (dayIndex === -1) {
                return msg.reply('Format: `!ingetin weekly <hari> HH.MM [pesan]`\nHari: minggu, senin, selasa, rabu, kamis, jumat, sabtu\nContoh: `!ingetin weekly jumat 20.00 bayar kos`');
            }
            const timeStr = args[3];
            const timeMatch = timeStr && timeStr.match(/^(\d{1,2})[.:](\d{2})$/);
            if (!timeMatch) {
                return msg.reply('Format: `!ingetin weekly <hari> HH.MM [pesan]`\nContoh: `!ingetin weekly jumat 20.00 bayar kos`');
            }
            const [, hour, minute] = timeMatch;
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + ((dayIndex - targetDate.getDay() + 7) % 7 || 7));
            targetDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
            pesan = args.slice(4).join(' ');
        } else if (sub === 'monthly') {
            // !ingetin monthly 5 09.00 bayar kos
            const dayNum = parseInt(args[2]);
            const timeStr = args[3];
            const timeMatch = timeStr && timeStr.match(/^(\d{1,2})[.:](\d{2})$/);
            if (isNaN(dayNum) || dayNum < 1 || dayNum > 31 || !timeMatch) {
                return msg.reply('Format: `!ingetin monthly <tanggal> HH.MM [pesan]`\nContoh: `!ingetin monthly 5 09.00 bayar kos`');
            }
            const [, hour, minute] = timeMatch;
            targetDate = new Date();
            targetDate.setDate(dayNum);
            targetDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
            if (targetDate <= new Date()) targetDate.setMonth(targetDate.getMonth() + 1);
            pesan = args.slice(4).join(' ');
        }
    } else {
        // One-shot: !ingetin [menit] [pesan]
        const menit = parseInt(sub);
        pesan = args.slice(2).join(' ');

        if (isNaN(menit) || !pesan) {
            return msg.reply(
                'Format:\n' +
                '• `!ingetin [menit] [pesan]` — sekali\n' +
                '• `!ingetin daily HH.MM [pesan]` — tiap hari\n' +
                '• `!ingetin weekly <hari> HH.MM [pesan]` — tiap minggu\n' +
                '• `!ingetin monthly <tanggal> HH.MM [pesan]` — tiap bulan'
            );
        }
        targetDate = new Date(Date.now() + menit * 60 * 1000);
    }

    if (!pesan) return msg.reply('Pesan reminder-nya apa?');

    await react(msg, '⏳');

    try {
        const sqlTime = toSQL(targetDate);
        const nextTime = recurrence ? toSQL(getNextTime(recurrence, targetDate)) : null;

        const sql = 'INSERT INTO reminders (user_id, pesan, waktu_eksekusi, recurrence, next_time) VALUES (?, ?, ?, ?, ?)';
        const [result] = await db.query(sql, [senderId, pesan, sqlTime, recurrence, nextTime]);

        scheduleJob(client, result.insertId, senderId, pesan, targetDate, recurrence);

        await react(msg, '✅');

        let confirmMsg = `✅ Reminder set!\n📝 *${pesan}*\n📅 ${targetDate.toLocaleString('id-ID')}`;
        if (recurrence) confirmMsg += `\n🔄 ${recurrence}`;
        await msg.reply(confirmMsg);
    } catch (e) {
        logger.error(e);
        await msg.reply('❌ Gagal simpan reminder.');
    }
};

// --- FUNGSI RESTORE (DIPANGGIL DI APP.JS) ---
module.exports.restoreReminders = async (client) => {
    logger.info('Cek Pending Reminders...');
    try {
        const sql = "SELECT * FROM reminders WHERE status = 'pending'";
        const [rows] = await db.query(sql);

        if (rows.length === 0) {
            logger.info('Tidak ada reminder pending.');
            return;
        }

        logger.info(`Merestore ${rows.length} reminder...`);

        for (const row of rows) {
            const waktu = row.next_time || row.waktu_eksekusi;
            logger.info(`Restore ID=${row.id} waktu="${waktu}" next_time="${row.next_time}" recurrence="${row.recurrence}"`);
            scheduleJob(client, row.id, row.user_id, row.pesan, waktu, row.recurrence);
        }
    } catch (e) {
        logger.error('Gagal restore reminder:', e);
    }

    // Safety net: periodic check setiap 30 detik
    if (safetyInterval) clearInterval(safetyInterval);
    safetyInterval = setInterval(async () => {
        try {
            const now = toSQL(new Date());
            const [rows] = await db.query(
                "SELECT * FROM reminders WHERE status = 'pending' AND waktu_eksekusi <= ?",
                [now]
            );
            for (const row of rows) {
                const waktu = row.next_time || row.waktu_eksekusi;
                const delay = new Date(waktu).getTime() - Date.now();
                if (delay <= 0) {
                    // Overdue — fire immediately via stagger
                    const staggerDelay = overdueCounter * OVERDUE_STAGGER_MS;
                    overdueCounter++;
                    setTimeout(() => {
                        (async () => {
                            try {
                                const [check] = await db.query('SELECT status FROM reminders WHERE id = ?', [row.id]);
                                if (check.length === 0 || check[0].status !== 'pending') return;
                                const overdueMin = Math.abs(Math.ceil(delay / 60000));
                                await client.sendMessage(row.user_id, `⏰ *REMINDER (TELAT ${overdueMin} menit)*: ${row.pesan}\n_(Maaf tadi bot sempat mati/restart)_`);
                                if (row.recurrence) {
                                    const next = getNextTime(row.recurrence, waktu);
                                    const sqlTime = toSQL(next);
                                    await db.query("UPDATE reminders SET waktu_eksekusi = ?, next_time = ? WHERE id = ?", [sqlTime, sqlTime, row.id]);
                                    scheduleJob(client, row.id, row.user_id, row.pesan, next, row.recurrence);
                                } else {
                                    await db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [row.id]);
                                }
                            } catch (e) { logger.error('Safety reminder error:', e.message); }
                        })();
                    }, staggerDelay);
                    logger.info(`[Safety] Reminder ID ${row.id} overdue, fires in ${staggerDelay}ms`);
                }
            }
        } catch { /* ignore */ }
    }, 30 * 1000);
    logger.info('Safety interval started (30s)');
};

module.exports.metadata = {
    category: 'LAINNYA',
    commands: [{ command: '!ingetin', desc: 'Reminder (list/hapus/daily/weekly/monthly)' }]
};
