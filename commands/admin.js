const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database'); // 👈 Kita panggil DB manual disini

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK
    // Kita pake config.ownerNumber biar sinkron sama config.js yang baru
    // Pastikan nomor lu ada di config.ownerNumber
    const isOwner = config.ownerNumber.includes(senderId.replace('@c.us', ''));

    if (!isOwner) {
        // Silent block (biar orang iseng gak tau ini command admin)
        return false;
    }

    const command = args[0]; // !update, !restart, dll

    // --- 1. COMMAND: UPDATE SYSTEM (!update) ---
    if (command === '!update' || command === '!gitpull') {
        try {
            await msg.react('⏳');
            await msg.reply("⏳ Sedang mengecek update dari GitHub...");
        } catch (e) { }

        exec('git pull', async (error, stdout, stderr) => {
            if (error) {
                return msg.reply(`❌ Gagal Update:\n${error.message}`);
            }

            if (stdout.includes('Already up to date')) {
                return msg.reply("✅ Udah paling baru Bos. Aman.");
            }

            // 👇 LOGIC PINTAR (Cek package.json)
            const needInstall = stdout.includes('package.json');
            let statusMsg = `✅ *UPDATE SUKSES!*\nFiles changed:\n${stdout}`;

            if (needInstall) {
                statusMsg += `\n\n📦 *Terdeteksi perubahan library!*\nSedang menjalankan 'npm install'...`;
                await msg.reply(statusMsg);

                exec('npm install', async (err) => {
                    if (err) {
                        await msg.reply("⚠️ Gagal install dependencies, tapi tetep restart...");
                    } else {
                        await msg.reply("✅ Library kelar diinstall.");
                    }
                    console.log("Install kelar, restart...");
                    setTimeout(() => { process.exit(0); }, 2000);
                });

            } else {
                statusMsg += `\n\n⚡ *Gak ada library baru.* Langsung restart...`;
                await msg.reply(statusMsg);
                console.log("Update kelar, restart...");
                setTimeout(() => { process.exit(0); }, 2000);
            }
        });
        return true;
    }

    // --- 2. COMMAND: HAPUS LOGS (!resetlogs) ---
    if (command === '!resetlogs' || command === '!clearlogs') {
        try {
            await msg.reply("⚠️ Menghapus history chat...");
            await db.query("TRUNCATE TABLE full_chat_logs");
            await msg.reply("✅ Logs bersih.");
        } catch (e) {
            console.error(e);
            msg.reply("❌ Gagal hapus logs.");
        }
        return true;
    }

    // --- 3. COMMAND: HAPUS MEMORI (!resetmemori) ---
    if (command === '!resetmemori') {
        try {
            await msg.reply("⚠️ Menghapus ingatan AI...");
            await db.query("TRUNCATE TABLE memori");
            await msg.reply("🤯 Otak bersih. Siap mulai lembaran baru.");
        } catch (e) { msg.reply("❌ Gagal reset memori."); }
        return true;
    }

    // --- 4. COMMAND: RESET FINANCE (!resetfinance) ---
    if (command === '!resetfinance') {
        try {
            await msg.reply("⚠️ Menghapus data keuangan...");
            await db.query("TRUNCATE TABLE transaksi");
            await msg.reply("💸 Dompet kosong (Data Reset).");
        } catch (e) { msg.reply("❌ Gagal reset finance."); }
        return true;
    }

    // --- 5. COMMAND: RESTART BOT (!restart) ---
    if (command === '!restart' || command === '!reboot') {
        await msg.reply("♻️ *Restarting System...*\nTunggu sebentar ya Bang.");
        console.log("⚠️ Manual Restart Triggered!");
        setTimeout(() => {
            process.exit(0); // Membunuh proses biar PM2 nyalain ulang
        }, 1000);
        return true;
    }

    return false;
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Git Pull & Restart' },
        { command: '!resetlogs', desc: 'Hapus Chat Logs' },
        { command: '!resetmemori', desc: 'Hapus Ingatan AI' },
        { command: '!resetfinance', desc: 'Hapus Data Keuangan' },
        { command: '!restart', desc: 'Restart Bot Manual' }
    ]
};