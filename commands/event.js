module.exports = async (client, msg, text, db, senderId) => {
    const chatDestination = msg.fromMe ? msg.to : msg.from;
    const args = text.split(' ');
    const command = args[1]; // tambah, list, hapus

    // 1. TAMBAH EVENT (!event tambah 2025-12-31 Tahun Baru)
    if (command === 'tambah' || command === 'add') {
        const dateStr = args[2];
        const eventName = args.slice(3).join(' ');

        // Validasi format tanggal (YYYY-MM-DD)
        if (!dateStr || !eventName || !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return client.sendMessage(chatDestination, "❌ Format salah!\nContoh: `!event tambah 2025-05-12 Ulang Tahun Dini`");
        }

        db.query("INSERT INTO events (nama_event, tanggal, dibuat_oleh) VALUES (?, ?, ?)",
            [eventName, dateStr, senderId], (err) => {
                if (err) return client.sendMessage(chatDestination, "❌ Gagal simpan ke database.");
                client.sendMessage(chatDestination, `✅ Siap! Event *"${eventName}"* pada *${dateStr}* berhasil disimpan.`);
            });
    }

    // 2. LIST EVENT (!event list) - Nampilin H-Minus
    else if (command === 'list' || !command) {
        db.query("SELECT * FROM events ORDER BY tanggal ASC", (err, rows) => {
            if (err || rows.length === 0) return client.sendMessage(chatDestination, "Belum ada event yang dicatat. Ketik `!event tambah` dulu.");

            let pesan = "🗓️ *AGENDA & EVENT MENDATANG* 🗓️\n\n";
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset jam biar itungan hari pas

            rows.forEach(row => {
                const eventDate = new Date(row.tanggal);
                const diffTime = eventDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Konversi ms ke hari

                let status = "";
                if (diffDays < 0) status = "✅ (Lewat)";
                else if (diffDays === 0) status = "🔥 *HARI INI!*";
                else status = `⏳ H-${diffDays}`;

                // Tampilin cuma yang belum lewat atau baru lewat 7 hari
                if (diffDays >= -7) {
                    pesan += `• *${row.nama_event}*\n   📅 ${row.tanggal.toISOString().split('T')[0]} | ${status}\n`;
                }
            });

            client.sendMessage(chatDestination, pesan);
        });
    }

    // 3. HAPUS EVENT (!event hapus ID)
    else if (command === 'hapus' || command === 'del') {
        const id = args[2];
        db.query("DELETE FROM events WHERE id = ?", [id], (err, res) => {
            if (err || res.affectedRows === 0) return client.sendMessage(chatDestination, "❌ Gagal hapus. ID salah mungkin?");
            client.sendMessage(chatDestination, "🗑️ Event berhasil dihapus.");
        });
    }
};

// --- FUNGSI OTOMATIS: CEK TIAP PAGI ---
// Fungsi ini bakal dipanggil di app.js
module.exports.cekEventHarian = (client, db, logNumber) => {
    // Cek database
    db.query("SELECT * FROM events", async (err, rows) => {
        if (err || !rows) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const row of rows) {
            const eventDate = new Date(row.tanggal);
            const diffTime = eventDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Notifikasi di momen krusial: H-7, H-3, H-1, dan HARI H
            if ([7, 3, 1, 0].includes(diffDays)) {
                let msg = "";
                if (diffDays === 0) msg = `🚨 *PENGUMUMAN HARI INI!* 🚨\n\nHari ini adalah: *"${row.nama_event}"*\nJangan lupa ya Bang!`;
                else msg = `⏰ *REMINDER EVENT* (H-${diffDays})\n\nPersiapan untuk: *"${row.nama_event}"*\nTanggal: ${row.tanggal.toISOString().split('T')[0]}`;

                // Kirim ke Log Number (Nomor Utama Lu)
                try {
                    await client.sendMessage(logNumber, msg);
                } catch (e) {
                    console.log("Gagal kirim reminder event");
                }
            }
        }
    });
};

// LABEL MENU (BIAR AUTO MUNCUL DI !MENU)
module.exports.metadata = {
    category: "EVENT",
    commands: [
        { command: '!event tambah [YYYY-MM-DD] [nama]', desc: 'Catat Event Penting' },
        { command: '!event list', desc: 'Cek Hitung Mundur Event' },
        { command: '!event hapus [id]', desc: 'Hapus Event' }
    ]
};