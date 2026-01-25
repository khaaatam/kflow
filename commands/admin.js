const config = require('../config');
const { exec } = require('child_process'); // Buat jalanin perintah terminal

module.exports = async (client, msg, text, db) => {
    // 🛡️ SECURITY CHECK: HANYA OWNER (TAMI) YANG BOLEH
    const senderId = msg.fromMe ? client.info.wid._serialized : msg.from;
    const namaPengirim = config.users[senderId];

    if (!namaPengirim || !namaPengirim.toLowerCase().includes('tami')) {
        return false;
    }

    // --- 1. COMMAND: UPDATE SYSTEM (!update) ---
    // Ini fitur yang lu minta biar gak usah buka Termux
    if (text === '!update' || text === '!gitpull') {
        await client.sendMessage(msg.from, "⏳ Sedang mengecek update dari GitHub...");

        // Jalanin 'git pull' di terminal server
        exec('git pull', async (error, stdout, stderr) => {
            if (error) {
                // Kalau ada error (misal conflict)
                console.error(`Git Error: ${error.message}`);
                return client.sendMessage(msg.from, `❌ Gagal Update:\n${error.message}`);
            }

            if (stdout.includes('Already up to date')) {
                return client.sendMessage(msg.from, "✅ Kodingan udah paling baru, Bos. Gak ada update.");
            }

            // Kalau ada update
            await client.sendMessage(msg.from, `✅ *UPDATE DITEMUKAN!*\n\nLog:\n${stdout}\n\n♻️ Bot sedang restart sendiri...`);

            // Tunggu bentar biar pesan ke kirim, terus matikan proses
            setTimeout(() => {
                process.exit(0);
                // PM2 bakal otomatis nyalain lagi (Restart) dengan kode baru
            }, 2000);
        });
        return true;
    }

    // --- 2. COMMAND: HAPUS LOGS CHAT (!resetlogs) ---
    if (text === '!resetlogs' || text === '!clearlogs') {
        await client.sendMessage(msg.from, "⚠️ *PERINGATAN:* Sedang menghapus SELURUH history chat...");
        db.query("TRUNCATE TABLE full_chat_logs", (err) => {
            if (err) client.sendMessage(msg.from, "❌ Gagal hapus logs.");
            else client.sendMessage(msg.from, "✅ *SUKSES!* Semua riwayat chat (Logs) sudah dimusnahkan. 🧹");
        });
        return true;
    }

    // --- 3. COMMAND: HAPUS MEMORI FAKTA (!resetmemori) ---
    if (text === '!resetmemori') {
        await client.sendMessage(msg.from, "⚠️ *PERINGATAN:* Sedang menghapus SEMUA FAKTA...");
        db.query("TRUNCATE TABLE memori", (err) => {
            if (err) client.sendMessage(msg.from, "❌ Gagal format otak.");
            else client.sendMessage(msg.from, "🤯 *BRAIN WASHED!* Otak bot kembali polos.");
        });
        return true;
    }

    // --- 4. COMMAND: RESTART BOT MANUAL (!resetbot) ---
    if (text === '!resetbot' || text === '!restart') {
        await client.sendMessage(msg.from, "♻️ Siap Bos, restart sistem...");
        setTimeout(() => process.exit(0), 1000);
        return true;
    }

    return false;
};

// METADATA UNTUK MENU
module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Tarik update dari GitHub (Auto Restart)' },
        { command: '!resetlogs', desc: 'Hapus Chat History (Admin Only)' },
        { command: '!resetmemori', desc: 'Hapus Memori Fakta (Admin Only)' },
        { command: '!resetbot', desc: 'Restart Bot (Admin Only)' }
    ]
};