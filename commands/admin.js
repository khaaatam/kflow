const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK
    const owners = config.ownerNumber || [];
    // Bersihin ID dari @c.us biar cocok sama config
    const cleanId = senderId.replace('@c.us', '');
    const isOwner = owners.includes(cleanId);

    if (!isOwner) return false; // Silent block

    const command = args[0];

    // --- 1. FORCE UPDATE (!forceupdate) ---
    if (command === '!forceupdate') {
        // 👇 Respon Awal
        await msg.reply("☢️ *FORCE UPDATE DIMULAI...*\nMenghapus semua perubahan di Termux & maksa ambil dari GitHub.");

        exec('git fetch --all && git reset --hard origin/main && git pull', async (error, stdout, stderr) => {
            if (error) {
                // Fallback ke branch 'master' kalau 'main' gak ada
                exec('git fetch --all && git reset --hard origin/master && git pull', async (err2, out2) => {
                    if (err2) return msg.reply(`❌ Gagal Force Update:\n${error.message}`);
                    await msg.reply("✅ *SUKSES SINKRONISASI (Master)*\nSekarang kodingan sama persis kayak di GitHub.\n♻️ Restarting...");
                    setTimeout(() => process.exit(0), 1000);
                });
                return;
            }
            await msg.reply(`✅ *SUKSES SINKRONISASI (Main)*\nOutput:\n\`\`\`${stdout}\`\`\`\n\n♻️ Restarting...`);
            setTimeout(() => process.exit(0), 1000);
        });
        return true;
    }

    // --- 2. UPDATE BIASA (!update) ---
    if (command === '!update' || command === '!gitpull') {
        // 👇 INI YANG LU CARI: Respon Konfirmasi Awal
        await msg.reply("⏳ *Sedang mengecek update dari GitHub...*");

        exec('git pull', async (error, stdout, stderr) => {
            if (error) {
                return msg.reply(`❌ Gagal Update:\n${error.message}\n\n*Tips:* Coba ketik *!forceupdate*`);
            }

            if (stdout.includes('Already up to date')) {
                return msg.reply("✅ *Bot sudah versi paling baru.* Aman Bos.");
            }

            const needInstall = stdout.includes('package.json');
            let statusMsg = `✅ *UPDATE BERHASIL!*\n\n📝 *Perubahan:*\n\`\`\`${stdout}\`\`\``;

            if (needInstall) {
                statusMsg += `\n\n📦 *Ada Library Baru!* Sedang menjalankan npm install...`;
                await msg.reply(statusMsg);
                exec('npm install', () => {
                    setTimeout(() => process.exit(0), 2000);
                });
            } else {
                statusMsg += `\n\n♻️ Restarting System...`;
                await msg.reply(statusMsg);
                setTimeout(() => process.exit(0), 2000);
            }
        });
        return true;
    }

    // --- 3. RESET & RESTART ---
    if (command === '!resetlogs') {
        await db.query("TRUNCATE TABLE full_chat_logs");
        msg.reply("✅ Logs chat bersih.");
        return true;
    }

    if (command === '!resetmemori') {
        await db.query("TRUNCATE TABLE memori");
        msg.reply("🧠 Memori AI bersih.");
        return true;
    }

    if (command === '!resetfinance') {
        await db.query("TRUNCATE TABLE transaksi");
        msg.reply("💸 Data keuangan di-reset ke 0.");
        return true;
    }

    if (command === '!restart') {
        await msg.reply("♻️ Restarting...");
        setTimeout(() => process.exit(0), 1000);
        return true;
    }

    return false;
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Cek Update GitHub' },
        { command: '!forceupdate', desc: 'Paksa Samakan GitHub' },
        { command: '!restart', desc: 'Restart Bot' },
        { command: '!resetfinance', desc: 'Reset Data Keuangan' },
        { command: '!resetmemori', desc: 'Reset AI Memory' },
        { command: '!resetlogs', desc: 'Reset Chat Logs' }
    ]
};