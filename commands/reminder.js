const schedule = require('node-schedule');
const moment = require('moment');

// Object buat nyimpen job yang aktif di memory
const activeJobs = {};

module.exports = async (client, msg, text, db, senderId) => { // Perhatikan: db gak perlu di-import ulang kalau udah di-pass dari handler
    // Kalau text kosong (cuma dipanggil buat init), skip logic parsing
    if (!text) return;

    const args = text.split(' ');

    if (args.length < 3) {
        return client.sendMessage(msg.from, "⚠️ Format salah.\n\n*Contoh:*\n`!ingatin 10m matikan kompor`\n`!ingatin 2026-01-20 08:00 meeting google`");
    }

    let targetTime = null;
    let pesan = "";

    // --- LOGIKA PARSING WAKTU ---
    const relativeMatch = args[1].match(/^(\d+)([mhs])$/);

    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2];
        targetTime = moment();
        if (unit === 'm') targetTime.add(amount, 'minutes');
        if (unit === 'h') targetTime.add(amount, 'hours');
        if (unit === 's') targetTime.add(amount, 'seconds');
        pesan = args.slice(2).join(' ');
    } else {
        const potentialDateStr = `${args[1]} ${args[2]}`;
        if (moment(potentialDateStr, 'YYYY-MM-DD HH:mm', true).isValid()) {
            targetTime = moment(potentialDateStr, 'YYYY-MM-DD HH:mm');
            pesan = args.slice(3).join(' ');
        } else {
            return client.sendMessage(msg.from, "❌ Format waktu gak dikenali.\nGunakan: `10m`, `1h`, atau `YYYY-MM-DD HH:mm`.");
        }
    }

    if (!pesan.trim()) return client.sendMessage(msg.from, "⚠️ Pesannya kosong bang.");
    if (targetTime.isBefore(moment())) return client.sendMessage(msg.from, "❌ Waktunya udah lewat bang.");

    const mysqlTime = targetTime.format('YYYY-MM-DD HH:mm:ss');
    const displayTime = targetTime.format('DD MMM, HH:mm');

    // --- SIMPAN KE DATABASE (MODE PROMISE) ---
    try {
        const [result] = await db.query(
            "INSERT INTO reminders (sender_id, pesan, waktu_eksekusi) VALUES (?, ?, ?)",
            [senderId, pesan, mysqlTime]
        );

        const reminderId = result.insertId;

        // --- JADWALIN JOB ---
        const job = schedule.scheduleJob(targetTime.toDate(), async function () {
            client.sendMessage(senderId, `⏰ *PENGINGAT DARI MASA LALU*\n\n"${pesan}"\n\n_Waktunya: ${displayTime}_`);

            // Update status (Promise)
            await db.query("UPDATE reminders SET status='sent' WHERE id=?", [reminderId]);
            delete activeJobs[reminderId];
        });

        activeJobs[reminderId] = job;
        client.sendMessage(msg.from, `✅ *Siap!* Gw ingetin:\n"${pesan}"\n\n📅 ${displayTime}`);

    } catch (err) {
        client.sendMessage(msg.from, "❌ Gagal nyatet jadwal: " + err.message);
    }
};

// --- FUNGSI RESTORE (MODE PROMISE) ---
module.exports.restoreReminders = async (client, db) => {
    console.log("🔄 [System] Me-restore jadwal pending...");

    try {
        const [rows] = await db.query("SELECT * FROM reminders WHERE status='pending' AND waktu_eksekusi > NOW()");

        let count = 0;
        rows.forEach(row => {
            const targetTime = new Date(row.waktu_eksekusi);

            const job = schedule.scheduleJob(targetTime, async function () {
                client.sendMessage(row.sender_id, `⏰ *PENGINGAT (RESTORED)*\n\n"${row.pesan}"`);
                await db.query("UPDATE reminders SET status='sent' WHERE id=?", [row.id]);
            });

            activeJobs[row.id] = job;
            count++;
        });

        if (count > 0) console.log(`✅ Berhasil restore ${count} jadwal.`);
    } catch (err) {
        console.error("Gagal restore:", err.message);
    }
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!ingatin [waktu] [pesan]', desc: 'Set Reminder (10m/1h)' }
    ]
};