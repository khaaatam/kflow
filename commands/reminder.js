const schedule = require('node-schedule');
const moment = require('moment');

// Object buat nyimpen job yang aktif di memory
const activeJobs = {};

module.exports = async (client, msg, text, db, senderId) => {
    // Format: !ingatin [waktu] [pesan]
    // Contoh: !ingatin 10m angkat jemuran
    // Contoh: !ingatin 2026-01-20 08:00 meeting

    const args = text.split(' ');
    const timeArg = args[1]; // "10m" atau "2026-..."
    const pesan = args.slice(2).join(' '); // "angkat jemuran"

    if (!timeArg || !pesan) {
        return client.sendMessage(msg.from, "Format salah bang.\nContoh: `!ingatin 10m masak air` atau `!ingatin 2026-01-20 08:00 meeting`");
    }

    let targetTime;

    // 1. Cek kalo formatnya Relative (10m, 1h, 30s)
    const relativeMatch = timeArg.match(/^(\d+)([mhs])$/);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2]; // m=menit, h=jam, s=detik

        targetTime = moment();
        if (unit === 'm') targetTime.add(amount, 'minutes');
        if (unit === 'h') targetTime.add(amount, 'hours');
        if (unit === 's') targetTime.add(amount, 'seconds');
    }
    // 2. Cek kalo formatnya Tanggal (YYYY-MM-DD HH:mm)
    else {
        // Coba gabungin args[1] sama args[2] kalo itu jam (misal: 2026-01-20 08:00)
        const potentialDateStr = args[1] + ' ' + args[2];
        if (moment(potentialDateStr, 'YYYY-MM-DD HH:mm', true).isValid()) {
            targetTime = moment(potentialDateStr, 'YYYY-MM-DD HH:mm');
            // Koreksi variabel pesan karena args[2] kepake buat jam
            pesan = args.slice(3).join(' ');
        } else {
            return client.sendMessage(msg.from, "Gw gak paham waktunya. Pake format `10m`, `1h`, atau `YYYY-MM-DD HH:mm` ya.");
        }
    }

    const mysqlTime = targetTime.format('YYYY-MM-DD HH:mm:ss');
    const displayTime = targetTime.format('DD MMM HH:mm');

    // 3. Simpen ke Database
    db.query("INSERT INTO reminders (sender_id, pesan, waktu_eksekusi) VALUES (?, ?, ?)",
        [senderId, pesan, mysqlTime], (err, result) => {
            if (err) return client.sendMessage(msg.from, "Gagal nyatet jadwal: " + err.message);

            const reminderId = result.insertId;

            // 4. Jadwalin Eksekusi
            const job = schedule.scheduleJob(targetTime.toDate(), function () {
                // Aksi pas waktu habis:
                client.sendMessage(senderId, `⏰ *PENGINGAT DARI MASA LALU*\n\n"${pesan}"\n\n_Waktunya: ${displayTime}_`);

                // Update status di DB jadi 'sent'
                db.query("UPDATE reminders SET status='sent' WHERE id=?", [reminderId]);

                // Hapus dari memory
                delete activeJobs[reminderId];
            });

            activeJobs[reminderId] = job;
            client.sendMessage(msg.from, `Oke, gw ingetin *" ${pesan} "* pada tanggal ${displayTime}.`);
        });
};

// --- FUNGSI RESTORE (PENTING) ---
// Dipanggil pas bot baru nyala (restart), biar jadwal yang belum kelar tetep jalan.
module.exports.restoreReminders = (client, db) => {
    console.log("🔄 Me-restore jadwal pending...");
    db.query("SELECT * FROM reminders WHERE status='pending' AND waktu_eksekusi > NOW()", (err, rows) => {
        if (err) return;

        rows.forEach(row => {
            const targetTime = new Date(row.waktu_eksekusi);
            const job = schedule.scheduleJob(targetTime, function () {
                client.sendMessage(row.sender_id, `⏰ *PENGINGAT (RESTORED)*\n\n"${row.pesan}"`);
                db.query("UPDATE reminders SET status='sent' WHERE id=?", [row.id]);
            });
            console.log(`✅ Jadwal ID ${row.id} berhasil direstore.`);
        });
    });
};