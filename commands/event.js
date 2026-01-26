const moment = require('moment');

module.exports = async (client, msg, text, db, senderId) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const args = text.split(' ');
    const command = args[1];

    try {
        // 1. TAMBAH EVENT
        if (command === 'tambah' || command === 'add') {
            const dateStr = args[2];
            const eventName = args.slice(3).join(' ');

            if (!dateStr || !eventName || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return client.sendMessage(chatDestination, "❌ Format salah!\nContoh: `!event tambah 2025-05-12 Ulang Tahun Dini`");
            }

            await db.query("INSERT INTO events (nama_event, tanggal, dibuat_oleh) VALUES (?, ?, ?)",
                [eventName, dateStr, senderId]);

            client.sendMessage(chatDestination, `✅ Siap! Event *"${eventName}"* pada *${dateStr}* berhasil disimpan.`);
        }

        // 2. LIST EVENT
        else if (command === 'list' || !command) {
            const [rows] = await db.query("SELECT * FROM events ORDER BY tanggal ASC");

            if (rows.length === 0) return client.sendMessage(chatDestination, "Belum ada event yang dicatat. Ketik `!event tambah` dulu.");

            let pesan = "🗓️ *AGENDA & EVENT MENDATANG* 🗓️\n\n";
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            rows.forEach(row => {
                const eventDate = new Date(row.tanggal);
                const diffTime = eventDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let status = "";
                if (diffDays < 0) status = "✅ (Lewat)";
                else if (diffDays === 0) status = "🔥 *HARI INI!*";
                else status = `⏳ H-${diffDays}`;

                if (diffDays >= -7) {
                    pesan += `• *${row.nama_event}*\n   📅 ${row.tanggal.toISOString().split('T')[0]} | ${status}\n`;
                }
            });

            client.sendMessage(chatDestination, pesan);
        }

        // 3. HAPUS EVENT
        else if (command === 'hapus' || command === 'del') {
            const id = args[2];
            const [res] = await db.query("DELETE FROM events WHERE id = ?", [id]);

            if (res.affectedRows === 0) return client.sendMessage(chatDestination, "❌ Gagal hapus. ID salah mungkin?");
            client.sendMessage(chatDestination, "🗑️ Event berhasil dihapus.");
        }

    } catch (err) {
        console.error("Event DB Error:", err);
        client.sendMessage(chatDestination, "❌ Terjadi kesalahan database.");
    }
};

// --- FUNGSI OTOMATIS: CEK TIAP PAGI (MODE PROMISE) ---
module.exports.cekEventHarian = async (client, db, logNumber) => {
    try {
        const [rows] = await db.query("SELECT * FROM events");
        if (!rows) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const row of rows) {
            const eventDate = new Date(row.tanggal);
            const diffTime = eventDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if ([7, 3, 1, 0].includes(diffDays)) {
                let msg = "";
                if (diffDays === 0) msg = `🚨 *PENGUMUMAN HARI INI!* 🚨\n\nHari ini adalah: *"${row.nama_event}"*\nJangan lupa ya Bang!`;
                else msg = `⏰ *REMINDER EVENT* (H-${diffDays})\n\nPersiapan untuk: *"${row.nama_event}"*\nTanggal: ${row.tanggal.toISOString().split('T')[0]}`;

                try {
                    await client.sendMessage(logNumber, msg);
                } catch (e) {
                    console.log("Gagal kirim reminder event");
                }
            }
        }
    } catch (err) {
        console.error("Cek Event Harian Error:", err);
    }
};

module.exports.metadata = {
    category: "EVENT",
    commands: [
        { command: '!event tambah [YYYY-MM-DD] [nama]', desc: 'Catat Event Penting' },
        { command: '!event list', desc: 'Cek Hitung Mundur Event' },
        { command: '!event hapus [id]', desc: 'Hapus Event' }
    ]
};