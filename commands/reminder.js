const db = require('../lib/database');
const logger = require('../lib/logger');
const react = require('../lib/react');

// --- HELPER: PENJADWAL TUGAS ---
// Fungsi ini dipake dua kali: pas bikin reminder baru & pas restore dari DB
let overdueCounter = 0;

const scheduleJob = (client, id, userId, pesan, waktuEksekusi) => {
    const now = new Date().getTime();
    const target = new Date(waktuEksekusi).getTime();
    const delay = target - now;

    // A. Kalau waktunya udah lewat (misal bot mati pas harusnya ngirim)
    if (delay <= 0) {
        const overdueMinutes = Math.abs(Math.ceil(delay / 1000 / 60));

        // Skip reminder yang terlalu tua (> 1 jam) — anggap sudah tidak relevan
        if (overdueMinutes > 60) {
            logger.info(`Reminder ID ${id} skipped (${overdueMinutes} menit telat — dianggap expired)`);
            db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
            return;
        }

        // Stagger: kasih jeda antar overdue biar gak spam
        const staggerDelay = overdueCounter * 2000; // 2 detik per reminder
        overdueCounter++;

        setTimeout(() => {
            client.sendMessage(userId, `⏰ *REMINDER (TELAT ${overdueMinutes} menit)*: ${pesan}\n_(Maaf tadi bot sempat mati/restart)_`);
            db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
        }, staggerDelay);

        logger.info(`Reminder ID ${id} overdue ${overdueMinutes}m, fires in ${staggerDelay}ms`);
        return;
    }

    // B. Kalau waktunya belum lewat, pasang timer
    setTimeout(async () => {
        try {
            const [rows] = await db.query("SELECT status FROM reminders WHERE id = ?", [id]);
            if (rows.length > 0 && rows[0].status === 'pending') {
                await client.sendMessage(userId, `⏰ *REMINDER*: ${pesan}`);
                await db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
            }
        } catch (e) {
            logger.error("Gagal kirim reminder:", e);
        }
    }, delay);

    logger.info(`Reminder ID ${id} dijadwalkan dalam ${Math.ceil(delay / 1000 / 60)} menit.`);
};

// --- COMMAND UTAMA (!ingetin) ---
module.exports = async (client, msg, args, senderId) => {
    const menit = parseInt(args[1]);
    const pesan = args.slice(2).join(' ');

    if (isNaN(menit) || !pesan) return msg.reply('Format: `!ingetin [menit] [pesan]`\nContoh: `!ingetin 10 angkat jemuran`');

    await react(msg, '⏳');

    // 1. Hitung Waktu Target (Waktu Sekarang + X Menit)
    const targetDate = new Date(Date.now() + menit * 60 * 1000);

    // Format ke SQL timestamp (YYYY-MM-DD HH:mm:ss)
    const toSQL = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
    const sqlTime = toSQL(targetDate);

    try {
        // 2. Simpan ke Database (Status: Pending)
        const sql = "INSERT INTO reminders (user_id, pesan, waktu_eksekusi) VALUES (?, ?, ?)";
        const [result] = await db.query(sql, [senderId, pesan, sqlTime]);

        // 3. Pasang Timer (Pake ID dari database barusan)
        scheduleJob(client, result.insertId, senderId, pesan, targetDate);

        await react(msg, '✅');
        await msg.reply(`✅ Siap! Gw ingetin *${pesan}* dalam ${menit} menit lagi.`);
    } catch (e) {
        logger.error(e);
        await msg.reply("❌ Gagal simpan reminder.");
    }
};

// --- FUNGSI RESTORE (DIPANGGIL DI APP.JS) ---
module.exports.restoreReminders = async (client) => {
    logger.info("Cek Pending Reminders...");
    try {
        // Ambil semua yang statusnya masih 'pending'
        const sql = "SELECT * FROM reminders WHERE status = 'pending'";
        const [rows] = await db.query(sql);

        if (rows.length === 0) {
            logger.info("Tidak ada reminder pending.");
            return;
        }

        logger.info(`Merestore ${rows.length} reminder...`);

        // Loop dan pasang ulang timer-nya
        for (const row of rows) {
            scheduleJob(client, row.id, row.user_id, row.pesan, row.waktu_eksekusi);
        }
    } catch (e) {
        logger.error("Gagal restore reminder:", e);
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [{ command: '!ingetin', desc: 'Set Reminder Anti-Lupa' }]
};