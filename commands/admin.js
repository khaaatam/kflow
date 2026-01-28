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
        try {
            await client.sendMessage(msg.from, "⏳ Sedang mengecek update dari GitHub...");
        } catch (e) { }

        exec('git pull', async (error, stdout, stderr) => {
            if (error) {
                try { await client.sendMessage(msg.from, `❌ Gagal Update:\n${error.message}`); } catch (e) { }
                return;
            }

            if (stdout.includes('Already up to date')) {
                try { await client.sendMessage(msg.from, "✅ Udah paling baru Bos. Aman."); } catch (e) { }
                return;
            }

            // 👇 LOGIC PINTAR DI SINI 👇
            // Cek apakah file 'package.json' ikut berubah?
            const needInstall = stdout.includes('package.json');

            let statusMsg = `✅ *UPDATE SUKSES!*\nFiles changed:\n${stdout}`;

            if (needInstall) {
                // Kalo ada perubahan library, baru kita install
                statusMsg += `\n\n📦 *Terdeteksi perubahan library!*\nSedang menjalankan 'npm install'...`;
                try { await client.sendMessage(msg.from, statusMsg); } catch (e) { }

                exec('npm install', async (err, std, ste) => {
                    if (err) {
                        try { await client.sendMessage(msg.from, "⚠️ Gagal install dependencies, tapi tetep restart..."); } catch (e) { }
                    } else {
                        try { await client.sendMessage(msg.from, "✅ Library kelar diinstall."); } catch (e) { }
                    }
                    // Restart setelah install
                    console.log("Install kelar, restart...");
                    setTimeout(() => { process.exit(0); }, 2000);
                });

            } else {
                // Kalo gak ada perubahan library, LANGSUNG RESTART (Hemat Waktu)
                statusMsg += `\n\n⚡ *Gak ada library baru.* Langsung restart...`;
                try { await client.sendMessage(msg.from, statusMsg); } catch (e) { }

                console.log("Gak perlu install, langsung restart...");
                setTimeout(() => { process.exit(0); }, 2000);
            }
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

    // --- 6. COMMAND: RESTART BOT ---
    if (text === '!restart' || text === '!reboot') {
        try {
            await client.sendMessage(msg.from, "♻️ *Restarting System...*\nTunggu sebentar ya Bang.");
        } catch (e) { }

        console.log("⚠️ Manual Restart Triggered!");
        setTimeout(() => {
            process.exit(0); // Membunuh proses biar PM2/Loop nyalain ulang
        }, 1000);
        return true;
    }

    return false;
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Git Pull & Restart' },
        { command: '!resetlogs', desc: 'Clear Chat Logs' },
        { command: '!resetmemori', desc: 'Clear Memori' },
        { command: '!resetfinance', desc: 'Clear Finance' },
        { command: '!restart', desc: 'Restart Bot' }
    ]
};