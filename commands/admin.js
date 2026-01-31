const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK
    const cleanId = String(senderId).replace('@c.us', '').replace('@g.us', '');
    if (!config.ownerNumber.includes(cleanId)) return false;

    const command = args[0].toLowerCase();

    // --- FITUR UPDATE ---
    if (command === '!update' || command === '!forceupdate') {
        const isForce = command === '!forceupdate';

        // Command Git:
        // !forceupdate -> RESET HARD (Hapus semua editan manual lu, samain kayak repo)
        // !update -> Coba pull biasa (Bakal gagal kalo ada konflik)
        const gitCmd = isForce
            ? 'git fetch --all && git reset --hard origin/main && git pull'
            : 'git pull';

        await msg.reply(isForce ? "☢️ *FORCE UPDATING...* (Bye-bye editan manual)" : "⏳ *Mengecek Update...*");

        // 🔥 TANGKEP ERROR STDERR JUGA
        exec(gitCmd, async (err, stdout, stderr) => {
            // Kalau ada error fatal di exec
            if (err) {
                let errorMsg = `❌ Gagal Exec: ${err.message}`;
                // Kalau error karena konflik file
                if (stderr && stderr.includes('Please commit your changes')) {
                    errorMsg = "⚠️ *GAGAL UPDATE: ADA FILE YANG LU EDIT MANUAL!*\n\nGit gak mau nimpa kerjaan lu. \n👉 Pake command: *!forceupdate* buat maksa update (editan lu bakal ilang).";
                }
                return msg.reply(errorMsg);
            }

            // Kalau stderr ada isinya (kadang git ngasih info di stderr walau sukses)
            if (stderr && !stdout) stdout = stderr;

            if (stdout.includes('Already up to date') && !isForce) {
                return msg.reply("✅ Bot sudah versi terbaru, Bang.");
            }

            let report = `✅ *GIT PULL SUKSES*\n\`\`\`${stdout}\`\`\`\n`;

            // Cek Package.json
            if (stdout.includes('package.json')) {
                report += "\n📦 *Library Baru Terdeteksi...*";
                await msg.reply(report + "\n⏳ Jalanin 'npm install'...");

                exec('npm install', (errInstall) => {
                    if (errInstall) return msg.reply("❌ Gagal npm install.");
                    client.sendMessage(msg.from, "✅ *Selesai!* Restarting... ♻️");
                    setTimeout(() => process.exit(0), 2000);
                });
            } else {
                await msg.reply(report + "\n♻️ Restarting...");
                setTimeout(() => process.exit(0), 2000);
            }
        });
        return true;
    }

    // ... (SISANYA BIARIN AJA SAMA KAYAK YANG LAMA) ...
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
        { command: '!update', desc: 'Update Bot (Cek conflict)' },
        { command: '!forceupdate', desc: 'Paksa Update (Reset Editan Manual)' },
        { command: '!restart', desc: 'Restart Bot' },
        { command: '!resetlogs', desc: 'Hapus Log Chat' },
        { command: '!resetmemori', desc: 'Hapus Memori AI' },
        { command: '!resetfinance', desc: 'Hapus Data Keuangan' }
    ]
};