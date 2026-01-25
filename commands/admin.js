const config = require('../config');

module.exports = async (client, msg, text, db) => {
    // 🛡️ SECURITY CHECK: HANYA OWNER (TAMI) YANG BOLEH
    // Cek ID pengirim & cocokkan dengan config
    const senderId = msg.fromMe ? client.info.wid._serialized : msg.from;
    const namaPengirim = config.users[senderId];

    // Kalau nama pengirim BUKAN Tami (case insensitive), TOLAK.
    if (!namaPengirim || !namaPengirim.toLowerCase().includes('tami')) {
        return false; // Anggap bukan command admin, lanjut ke logic biasa
    }

    // --- 1. COMMAND: HAPUS LOGS CHAT (!resetlogs) ---
    if (text === '!resetlogs' || text === '!clearlogs') {
        await client.sendMessage(msg.from, "⚠️ *PERINGATAN:* Sedang menghapus SELURUH history chat (Log Obrolan)...");

        const query = "TRUNCATE TABLE full_chat_logs"; // Bersih total

        db.query(query, (err) => {
            if (err) {
                console.error("Gagal hapus logs:", err);
                client.sendMessage(msg.from, "❌ Gagal menghapus logs. Cek console.");
            } else {
                client.sendMessage(msg.from, "✅ *SUKSES!* Semua riwayat chat (Logs) sudah dimusnahkan.\nBot sekarang amnesia soal obrolan masa lalu. 🧹");
                console.log("🧹 FULL CHAT LOGS CLEARED BY ADMIN");
            }
        });
        return true; // Stop proses
    }

    // --- 2. COMMAND: HAPUS MEMORI FAKTA (!resetmemori) ---
    if (text === '!resetmemori') {
        await client.sendMessage(msg.from, "⚠️ *PERINGATAN:* Sedang menghapus SEMUA FAKTA (Nama, Hobi, dll)...");

        db.query("TRUNCATE TABLE memori", (err) => {
            if (err) {
                client.sendMessage(msg.from, "❌ Gagal format otak: " + err.message);
            } else {
                client.sendMessage(msg.from, "🤯 *BRAIN WASHED!* Otak bot kembali polos seperti bayi baru lahir. 👶");
                console.log("🧠 MEMORY CLEARED BY ADMIN");
            }
        });
        return true;
    }

    // --- 3. COMMAND: RESTART BOT (!resetbot / !restart) ---
    if (text === '!resetbot' || text === '!restart') {
        await client.sendMessage(msg.from, "♻️ Siap Bos, restart sistem... (Tunggu 5 detik)");
        console.log("♻️ RESTART TRIGGERED BY ADMIN");
        setTimeout(() => {
            process.exit(0); // PM2 akan otomatis nyalain lagi
        }, 1000);
        return true;
    }

    return false; // Kalau bukan command admin, kembalikan false
};

// METADATA UNTUK MENU
module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!resetlogs', desc: 'Hapus Chat History (Admin Only)' },
        { command: '!resetmemori', desc: 'Hapus Memori Fakta (Admin Only)' },
        { command: '!resetbot', desc: 'Restart Bot (Admin Only)' }
    ]
};