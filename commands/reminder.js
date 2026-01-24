const schedule = require('node-schedule');
const moment = require('moment');

// Object buat nyimpen job yang aktif di memory (biar bisa dicancel kalo butuh)
const activeJobs = {};

module.exports = async (client, msg, text, db, senderId) => {
    // Format 1: !ingatin 10m angkat jemuran (args[1]=waktu, args[2++]=pesan)
    // Format 2: !ingatin 2026-01-20 08:00 meeting (args[1]+[2]=waktu, args[3++]=pesan)

    const args = text.split(' ');

    // Validasi awal: minimal ada command, waktu, dan pesan
    if (args.length < 3) {
        return client.sendMessage(msg.from, "⚠️ Format salah.\n\n*Contoh:*\n`!ingatin 10m matikan kompor`\n`!ingatin 2026-01-20 08:00 meeting google`");
    }

    let targetTime = null;
    let pesan = "";

    // --- LOGIKA PARSING WAKTU ---

    // 1. Cek Format Relative (10m, 1h, 30s)
    const relativeMatch = args[1].match(/^(\d+)([mhs])$/);

    if (relativeMatch) {
        // Kasus: !ingatin 10m ...
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2]; // m=menit, h=jam, s=detik

        targetTime = moment();
        if (unit === 'm') targetTime.add(amount, 'minutes');
        if (unit === 'h') targetTime.add(amount, 'hours');
        if (unit === 's') targetTime.add(amount, 'seconds');

        // Pesan diambil dari kata ke-3 sampe akhir
        pesan = args.slice(2).join(' ');

    } else {
        // 2. Cek Format Tanggal Lengkap (YYYY-MM-DD HH:mm)
        // Gabungin arg 1 & 2 buat ngecek tanggal + jam
        const potentialDateStr = `${args[1]} ${args[2]}`;

        // Cek validitas pake Moment (Strict Mode)
        if (moment(potentialDateStr, 'YYYY-MM-DD HH:mm', true).isValid()) {
            targetTime = moment(potentialDateStr, 'YYYY-MM-DD HH:mm');

            // Pesan diambil dari kata ke-4 sampe akhir (karena arg 1&2 kepake waktu)
            pesan = args.slice(3).join(' ');
        } else {
            // Kalau formatnya ngaco
            return client.sendMessage(msg.from, "❌ Format waktu gak dikenali.\nGunakan: `10m` (menit), `1h` (jam), atau `YYYY-MM-DD HH:mm`.");
        }
    }

    // --- VALIDASI PESAN KOSONG ---
    if (!pesan.trim()) {
        return client.sendMessage(msg.from, "⚠️ Lah, mau diingetin apa? Pesannya kosong bang.");
    }

    // --- VALIDASI WAKTU LAMPAU ---
    if (targetTime.isBefore(moment())) {
        return client.sendMessage(msg.from, "❌ Waktunya udah lewat bang. Lu mau kembali ke masa lalu?");
    }

    const mysqlTime = targetTime.format('YYYY-MM-DD HH:mm:ss');
    const displayTime = targetTime.format('DD MMM, HH:mm');

    // --- SIMPAN KE DATABASE ---
    db.query("INSERT INTO reminders (sender_id, pesan, waktu_eksekusi) VALUES (?, ?, ?)",
        [senderId, pesan, mysqlTime], (err, result) => {
            if (err) return client.sendMessage(msg.from, "❌ Gagal nyatet jadwal: " + err.message);

            const reminderId = result.insertId;

            // --- JADWALIN JOB ---
            const job = schedule.scheduleJob(targetTime.toDate(), function () {
                // Aksi pas waktu habis:
                client.sendMessage(senderId, `⏰ *PENGINGAT DARI MASA LALU*\n\n"${pesan}"\n\n_Waktunya: ${displayTime}_`);

                // Update status di DB jadi 'sent'
                db.query("UPDATE reminders SET status='sent' WHERE id=?", [reminderId]);

                // Hapus dari memory activeJobs
                delete activeJobs[reminderId];
            });

            // Simpan job ke memory biar bisa dilacak (opsional)
            activeJobs[reminderId] = job;

            client.sendMessage(msg.from, `✅ *Siap!* Gw ingetin:\n"${pesan}"\n\n📅 ${displayTime}`);
        });
};

// --- FUNGSI RESTORE (Jalan Pas Bot Restart) ---
module.exports.restoreReminders = (client, db) => {
    console.log("🔄 [System] Me-restore jadwal pending...");

    // Ambil jadwal yang statusnya 'pending' DAN waktunya belum lewat
    db.query("SELECT * FROM reminders WHERE status='pending' AND waktu_eksekusi > NOW()", (err, rows) => {
        if (err) return console.error("Gagal restore:", err);

        let count = 0;
        rows.forEach(row => {
            const targetTime = new Date(row.waktu_eksekusi);

            // Jadwalin ulang
            const job = schedule.scheduleJob(targetTime, function () {
                client.sendMessage(row.sender_id, `⏰ *PENGINGAT (RESTORED)*\n\n"${row.pesan}"`);
                db.query("UPDATE reminders SET status='sent' WHERE id=?", [row.id]);
            });

            activeJobs[row.id] = job;
            count++;
        });

        if (count > 0) console.log(`✅ Berhasil restore ${count} jadwal.`);
    });
};

// ... kodingan lama ...

// TAMBAHAN METADATA MENU
module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!ingatin [waktu] [pesan]', desc: 'Set Reminder (10m/1h)' }
    ]
};