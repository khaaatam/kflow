const db = require('../lib/database');
const logger = require('../lib/logger');
const react = require('../lib/react');

// Helper: hitung selisih hari dari tanggal ke today (midnight)
const diffDaysFromToday = (dateStr) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
};

// Helper: format tanggal ke "DD MMM YYYY" (Indo)
const fmtDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

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

            await react(msg, '⏳');
            await db.query("INSERT INTO events (nama_event, tanggal, dibuat_oleh) VALUES (?, ?, ?)",
                [eventName, dateStr, senderId]);
            await react(msg, '✅');

            return msg.reply(`✅ Event *"${eventName}"* (${dateStr}) disimpan.`);
        }

        // 2. LIST EVENT
        if (subCommand === 'list' || !subCommand) {
            await react(msg, '⏳');
            const [rows] = await db.query("SELECT * FROM events ORDER BY tanggal ASC");
            await react(msg, '✅');
            if (rows.length === 0) return msg.reply("Belum ada event. `!event tambah` dulu.");

            let pesan = "🗓️ *AGENDA MENDATANG* 🗓️\n\n";

            rows.forEach(row => {
                const diffDays = diffDaysFromToday(row.tanggal);

                let status = diffDays < 0 ? "✅ (Lewat)" : diffDays === 0 ? "🔥 *HARI INI!*" : `⏳ H-${diffDays}`;

                if (diffDays >= -7) { // Tampilkan yg baru lewat seminggu atau akan datang
                    pesan += `• *${row.nama_event}*\n   📅 ${fmtDate(row.tanggal)} | ${status}\n`;
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
        logger.error(err);
        await msg.reply("❌ Database Error.");
    }
};

// --- FUNGSI BACKGROUND (Dipanggil App.js) ---
module.exports.cekEventHarian = async (client, dbParam, logNumber) => {
    try {
        const database = dbParam || db; // Pake DB yg dikirim app.js atau yg di-require
        const [rows] = await database.query("SELECT * FROM events");

        for (const row of rows) {
            const diffDays = diffDaysFromToday(row.tanggal);

            if ([7, 3, 1, 0].includes(diffDays)) {
                let msg = diffDays === 0
                    ? `🚨 *HARI INI!* "${row.nama_event}"`
                    : `⏰ *REMINDER H-${diffDays}*: "${row.nama_event}"`;

                if (logNumber) {
                    const baseId = logNumber.replace(/@.*/, '');
                    try { await client.sendMessage(`${baseId}@c.us`, msg); }
                    catch { try { await client.sendMessage(`${baseId}@lid`, msg); } catch { /* skip */ } }
                }
            }
        }
    } catch (e) { logger.error("Event Check Error:", e); }
};

module.exports.metadata = {
    category: "EVENT",
    commands: [
        { command: '!event', desc: 'Kelola Agenda (tambah/list/hapus)' }
    ]
};