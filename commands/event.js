const moment = require('moment');
const db = require('../lib/database'); // Import DB manual karena handler baru gak ngirim db

module.exports = async (client, msg, args, senderId) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const subCommand = args[1]; // tambah, list, hapus

    try {
        // 1. TAMBAH EVENT
        if (subCommand === 'tambah' || subCommand === 'add') {
            const dateStr = args[2];
            const eventName = args.slice(3).join(' ');

            if (!dateStr || !eventName || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return msg.reply("❌ Format: `!event tambah YYYY-MM-DD Nama Event`");
            }

            await db.query("INSERT INTO events (nama_event, tanggal, dibuat_oleh) VALUES (?, ?, ?)",
                [eventName, dateStr, senderId]);

            return msg.reply(`✅ Event *"${eventName}"* (${dateStr}) disimpan.`);
        }

        // 2. LIST EVENT
        if (subCommand === 'list' || !subCommand) {
            const [rows] = await db.query("SELECT * FROM events ORDER BY tanggal ASC");
            if (rows.length === 0) return msg.reply("Belum ada event. `!event tambah` dulu.");

            let pesan = "🗓️ *AGENDA MENDATANG* 🗓️\n\n";
            const today = moment().startOf('day');

            rows.forEach(row => {
                const eventDate = moment(row.tanggal);
                const diffDays = eventDate.diff(today, 'days');

                let status = diffDays < 0 ? "✅ (Lewat)" : diffDays === 0 ? "🔥 *HARI INI!*" : `⏳ H-${diffDays}`;

                if (diffDays >= -7) { // Tampilkan yg baru lewat seminggu atau akan datang
                    pesan += `• *${row.nama_event}*\n   📅 ${moment(row.tanggal).format('DD MMM YYYY')} | ${status}\n`;
                }
            });
            return client.sendMessage(chatDestination, pesan);
        }

        // 3. HAPUS EVENT
        if (subCommand === 'hapus' || subCommand === 'del') {
            const id = args[2];
            if (!id) return msg.reply("ID mana? Cek `!event list` dulu.");

            await db.query("DELETE FROM events WHERE id = ?", [id]);
            return msg.reply("🗑️ Event dihapus.");
        }

    } catch (err) {
        console.error(err);
        msg.reply("❌ Database Error.");
    }
};

// --- FUNGSI BACKGROUND (Dipanggil App.js) ---
module.exports.cekEventHarian = async (client, dbParam, logNumber) => {
    try {
        const database = dbParam || db; // Pake DB yg dikirim app.js atau yg di-require
        const [rows] = await database.query("SELECT * FROM events");
        const today = moment().startOf('day');

        for (const row of rows) {
            const eventDate = moment(row.tanggal);
            const diffDays = eventDate.diff(today, 'days');

            if ([7, 3, 1, 0].includes(diffDays)) {
                let msg = diffDays === 0
                    ? `🚨 *HARI INI!* "${row.nama_event}"`
                    : `⏰ *REMINDER H-${diffDays}*: "${row.nama_event}"`;

                if (logNumber) await client.sendMessage(logNumber, msg);
            }
        }
    } catch (e) { console.error("Event Check Error:", e); }
};

module.exports.metadata = {
    category: "EVENT",
    commands: [
        { command: '!event', desc: 'Kelola Agenda (tambah/list/hapus)' }
    ]
};