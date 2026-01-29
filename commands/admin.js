const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ 1. SECURITY CHECK (DENGAN LOG DEBUG)
    const owners = config.ownerNumber || [];
    // Format ID dari WA biasanya: 628xxx@c.us -> Kita ambil angkanya doang
    const cleanId = senderId.replace('@c.us', '');

    const isOwner = owners.includes(cleanId);

    // 👇 LOG INI BAKAL MUNCUL DI TERMINAL
    console.log(`[ADMIN CHECK] Sender: ${cleanId} | Is Owner? ${isOwner}`);

    if (!isOwner) return false; // Silent block buat orang asing

    const command = args[0];

    // --- 2. COMMAND: FORCE UPDATE (!forceupdate) ---
    // Gunakan ini kalau !update biasa gagal karena "Conflict"
    if (command === '!forceupdate') {
        await msg.reply("☢️ *FORCE UPDATE DETECTED*\nMenghapus perubahan lokal & maksa tarik dari GitHub...");

        // Command sakti: Reset hard ke origin/main (atau master)
        // Pastikan branch lu 'main' atau 'master', sesuaikan di bawah
        exec('git fetch --all && git reset --hard origin/main && git pull', async (error, stdout, stderr) => {
            if (error) {
                // Coba fallback ke 'master' kalau 'main' gagal
                exec('git fetch --all && git reset --hard origin/master && git pull', async (err2, out2) => {
                    if (err2) return msg.reply(`❌ Gagal Total:\n${error.message}`);
                    await msg.reply("✅ Sukses Force Update (via Master).\nRestarting...");
                    setTimeout(() => process.exit(0), 1000);
                });
                return;
            }
            await msg.reply(`✅ *SUKSES SINKRONISASI!*\nSekarang kodingan sama persis kayak di GitHub.\n\nRestarting...`);
            setTimeout(() => process.exit(0), 1000);
        });
        return true;
    }

    // --- 3. COMMAND: UPDATE BIASA (!update) ---
    if (command === '!update' || command === '!gitpull') {
        try { await msg.react('⏳'); } catch (e) { }

        exec('git pull', async (error, stdout, stderr) => {
            if (error) {
                return msg.reply(`❌ Gagal Update (Mungkin Conflict?):\nCoba ketik: *!forceupdate*\n\nError: ${error.message}`);
            }
            if (stdout.includes('Already up to date')) return msg.reply("✅ Udah paling baru Bos.");

            const needInstall = stdout.includes('package.json');
            let statusMsg = `✅ *UPDATE SUKSES!*\nChanged:\n${stdout}`;

            if (needInstall) {
                statusMsg += `\n📦 Install libs...`;
                await msg.reply(statusMsg);
                exec('npm install', () => {
                    setTimeout(() => process.exit(0), 1000);
                });
            } else {
                statusMsg += `\n⚡ Restarting...`;
                await msg.reply(statusMsg);
                setTimeout(() => process.exit(0), 1000);
            }
        });
        return true;
    }

    // --- 4. COMMAND LAINNYA ---
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
        { command: '!forceupdate', desc: 'Paksa Update (Hapus Local Changes)' },
        { command: '!update', desc: 'Git Pull Aman' },
        { command: '!restart', desc: 'Restart Bot' },
        { command: '!resetfinance', desc: 'Reset Data Keuangan' }
    ]
};