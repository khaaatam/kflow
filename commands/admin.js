const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK (Cuma Owner yang boleh)
    // Pastikan senderId string biar replace gak error
    const cleanId = String(senderId).replace('@c.us', '').replace('@g.us', '');

    // Cek apakah user ada di daftar owner config.js
    if (!config.ownerNumber.includes(cleanId)) return false;

    const command = args[0];

    // --- FITUR UPDATE (AUTO NPM INSTALL) ---
    if (command === '!update' || command === '!forceupdate') {
        const isForce = command === '!forceupdate';
        // Kalau force, reset hard dulu baru pull
        const gitCmd = isForce
            ? 'git fetch --all && git reset --hard origin/main && git pull'
            : 'git pull';

        await msg.reply(isForce ? "☢️ *FORCE UPDATING...*" : "⏳ *Mengecek Update...*");

        exec(gitCmd, async (err, stdout) => {
            if (err) return msg.reply(`❌ Gagal Git: ${err.message}`);

            // Kalau gak ada update
            if (stdout.includes('Already up to date') && !isForce) {
                return msg.reply("✅ Bot sudah versi terbaru, Bang.");
            }

            // Kalau ada update
            let report = `✅ *GIT PULL SUKSES*\n\`\`\`${stdout}\`\`\`\n`;

            // 🔍 DETEKSI APAKAH package.json BERUBAH?
            if (stdout.includes('package.json')) {
                report += "\n📦 *Mendeteksi Library Baru...*";
                report += "\n⏳ _Sedang menjalankan 'npm install', tunggu bentar..._";
                await msg.reply(report);

                // 🔥 JALANKAN NPM INSTALL
                exec('npm install', (errInstall, stdoutInstall) => {
                    if (errInstall) {
                        return msg.reply(`❌ Gagal npm install: ${errInstall.message}\nCoba manual aja bang di terminal.`);
                    }

                    client.sendMessage(msg.from, "✅ *Library Terinstall!* Restarting bot sekarang... ♻️");

                    // Restart PM2
                    setTimeout(() => process.exit(0), 2000);
                });

            } else {
                // Kalau cuma update kodingan biasa (gak ada library baru)
                report += "\n♻️ Restarting bot...";
                await msg.reply(report);
                setTimeout(() => process.exit(0), 2000);
            }
        });
        return true;
    }

    // --- RESET DATA ---
    if (command === '!resetlogs') {
        await db.query("TRUNCATE TABLE full_chat_logs");
        msg.reply("✅ Chat logs dihapus bersih.");
        return true;
    }
    if (command === '!resetmemori') {
        await db.query("TRUNCATE TABLE memori");
        msg.reply("🧠 Memori AI direset.");
        return true;
    }
    if (command === '!resetfinance') {
        await db.query("TRUNCATE TABLE transaksi");
        msg.reply("💸 Data keuangan direset.");
        return true;
    }

    // --- RESTART MANUAL ---
    if (command === '!restart') {
        await msg.reply("♻️ Restarting manually...");
        setTimeout(() => process.exit(0), 1000);
        return true;
    }

    return false;
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Update Bot & Dependencies' },
        { command: '!forceupdate', desc: 'Paksa Update (Reset Local)' },
        { command: '!restart', desc: 'Restart Bot' },
        { command: '!resetlogs', desc: 'Hapus Log Chat' }
    ]
};