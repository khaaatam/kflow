const db = require('../lib/database');

// --- HELPER: PENJADWAL TUGAS ---
// Fungsi ini dipake dua kali: pas bikin reminder baru & pas restore dari DB
const scheduleJob = (client, id, userId, pesan, waktuEksekusi) => {
    const now = new Date().getTime();
    const target = new Date(waktuEksekusi).getTime();
    const delay = target - now;

    // A. Kalau waktunya udah lewat (misal bot mati pas harusnya ngirim)
    // Langsung kirim sekarang juga!
    if (delay <= 0) {
        client.sendMessage(userId, `⏰ *REMINDER (TELAT)*: ${pesan}\n_(Maaf tadi bot sempat mati/restart)_`);
        db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
        return;
    }

    // B. Kalau waktunya belum lewat, pasang timer
    setTimeout(async () => {
        try {
            // Cek dulu di DB, siapa tau user udah hapus manual (Next update)
            const [rows] = await db.query("SELECT status FROM reminders WHERE id = ?", [id]);
            if (rows.length > 0 && rows[0].status === 'pending') {

                await client.sendMessage(userId, `⏰ *REMINDER*: ${pesan}`);

                // Tandai selesai di database
                await db.query("UPDATE reminders SET status = 'done' WHERE id = ?", [id]);
            }
        } catch (e) {
            console.error("Gagal kirim reminder:", e);
        }
    }, delay);

    console.log(`✅ Reminder ID ${id} dijadwalkan dalam ${Math.ceil(delay / 1000 / 60)} menit.`);
};

// --- COMMAND UTAMA (!ingetin) ---
module.exports = async (client, msg, args, senderId) => {
    const menit = parseInt(args[1]);
    const pesan = args.slice(2).join(' ');

    if (isNaN(menit) || !pesan) return msg.reply('Format: `!ingetin [menit] [pesan]`\nContoh: `!ingetin 10 angkat jemuran`');

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

        msg.reply(`✅ Siap! Gw ingetin *${pesan}* dalam ${menit} menit lagi.`);
    } catch (e) {
        console.error(e);
        msg.reply("❌ Gagal simpan reminder.");
    }
};

// --- FUNGSI RESTORE (DIPANGGIL DI APP.JS) ---
module.exports.restoreReminders = async (client) => {
    console.log("🔄 Cek Pending Reminders...");
    try {
        // Ambil semua yang statusnya masih 'pending'
        const sql = "SELECT * FROM reminders WHERE status = 'pending'";
        const [rows] = await db.query(sql);

        if (rows.length === 0) {
            console.log("✅ Tidak ada reminder pending.");
            return;
        }

        console.log(`📥 Merestore ${rows.length} reminder...`);

        // Loop dan pasang ulang timer-nya
        for (const row of rows) {
            scheduleJob(client, row.id, row.user_id, row.pesan, row.waktu_eksekusi);
        }
    } catch (e) {
        console.error("❌ Gagal restore reminder:", e);
    }
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [{ command: '!ingetin', desc: 'Set Reminder Anti-Lupa' }]
};