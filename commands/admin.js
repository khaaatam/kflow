const config = require('../config');
const { exec } = require('child_process');

module.exports = async (client, msg, text, db) => {
    // 🛡️ SECURITY CHECK
    const senderId = msg.fromMe ? client.info.wid._serialized : msg.from;
    const namaPengirim = config.users[senderId];

    if (!namaPengirim || !namaPengirim.toLowerCase().includes('tami')) {
        return false;
    }

    // --- 1. COMMAND: UPDATE SYSTEM (!update) ---
    if (text === '!update' || text === '!gitpull') {
        // 👇 TRY-CATCH BIAR GAK CRASH KALAU GAGAL KIRIM CHAT
        try {
            await client.sendMessage(msg.from, "⏳ Sedang mengecek update dari GitHub...");
        } catch (e) {
            console.log("⚠️ Gagal kirim pesan loading, tapi tetep lanjut update...");
        }

        exec('git pull', async (error, stdout, stderr) => {
            if (error) {
                console.error(`Git Error: ${error.message}`);
                // Coba lapor error, kalau gagal yaudah
                try { await client.sendMessage(msg.from, `❌ Gagal Update:\n${error.message}`); } catch (e) { }
                return;
            }

            if (stdout.includes('Already up to date')) {
                try { await client.sendMessage(msg.from, "✅ Udah paling baru Bos."); } catch (e) { }
                return;
            }

            // Kalau update sukses
            try {
                await client.sendMessage(msg.from, `✅ *UPDATE SUKSES!*\n\n${stdout}\n\n♻️ Restarting...`);
            } catch (e) {
                console.log("Update sukses, otw restart...");
            }

            setTimeout(() => {
                process.exit(0);
            }, 2000);
        });
        return true;
    }

    // --- 2. COMMAND: HAPUS LOGS (!resetlogs) ---
    if (text === '!resetlogs' || text === '!clearlogs') {
        try {
            await client.sendMessage(msg.from, "⚠️ Menghapus history chat...");
            await db.query("TRUNCATE TABLE full_chat_logs");
            await client.sendMessage(msg.from, "✅ Logs bersih.");
        } catch (e) { client.sendMessage(msg.from, "❌ Gagal."); }
        return true;
    }

    // --- 3. COMMAND: HAPUS MEMORI ---
    if (text === '!resetmemori') {
        try {
            await client.sendMessage(msg.from, "⚠️ Menghapus ingatan...");
            await db.query("TRUNCATE TABLE memori");
            await client.sendMessage(msg.from, "🤯 Otak bersih.");
        } catch (e) { client.sendMessage(msg.from, "❌ Gagal."); }
        return true;
    }

    // --- 5. COMMAND: RESET FINANCE ---
    if (text === '!resetfinance') {
        try {
            await client.sendMessage(msg.from, "⚠️ Hapus data keuangan...");
            await db.query("TRUNCATE TABLE transaksi");
            await client.sendMessage(msg.from, "💸 Dompet kosong.");
        } catch (e) { client.sendMessage(msg.from, "❌ Gagal."); }
        return true;
    }

    return false;
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Git Pull & Restart' },
        { command: '!resetlogs', desc: 'Clear Logs' },
        { command: '!resetfinance', desc: 'Clear Finance' },
        { command: '!restart', desc: 'Restart Bot' }
    ]
};