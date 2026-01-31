const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK (VERSION: ANTI-BUNTUT)
    // Kita ambil angkanya doang biar ID aneh-aneh tetep kebaca
    const cleanSender = String(senderId).replace(/[^0-9]/g, '');
    const cleanOwners = config.ownerNumber.map(id => String(id).replace(/[^0-9]/g, ''));

    // Cek apakah pengirim adalah Owner
    if (!cleanOwners.includes(cleanSender)) {
        console.log(`⛔ Access Denied: ${cleanSender} bukan Owner.`);
        return false;
    }

    const command = args[0].toLowerCase();

    // --- FITUR UPDATE ---
    if (command === '!update' || command === '!forceupdate') {
        const isForce = command === '!forceupdate';
        const gitCmd = isForce
            ? 'git fetch --all && git reset --hard origin/main && git pull'
            : 'git pull';

        await msg.reply(isForce ? "☢️ *FORCE UPDATING...*" : "⏳ *Mengecek Update...*");

        exec(gitCmd, async (err, stdout, stderr) => {
            if (err) {
                let errorMsg = `❌ Gagal: ${err.message}`;
                if (stderr && stderr.includes('Please commit')) {
                    errorMsg = "⚠️ *ADA KONFLIK!* Ketik *!forceupdate* buat reset.";
                }
                return msg.reply(errorMsg);
            }

            const output = stdout || stderr || "Done.";
            if (output.includes('Already up to date') && !isForce) return msg.reply("✅ Bot udah paling update.");

            if (output.includes('package.json')) {
                await msg.reply("📦 *Install Library Baru...*");
                exec('npm install', () => {
                    client.sendMessage(msg.from, "✅ *Selesai!* Restarting... ♻️");
                    setTimeout(() => process.exit(0), 2000);
                });
            } else {
                await msg.reply(`✅ *Update Sukses*\n\n♻️ Restarting...`);
                setTimeout(() => process.exit(0), 2000);
            }
        });
        return true;
    }

    // --- SYSTEM UTILS ---
    if (command === '!restart') {
        await msg.reply("♻️ Restarting...");
        setTimeout(() => process.exit(0), 1000);
        return true;
    }

    if (command === '!resetlogs') {
        await db.query("TRUNCATE TABLE full_chat_logs");
        msg.reply("✅ Chat logs bersih.");
        return true;
    }

    if (command === '!resetmemori') {
        await db.query("TRUNCATE TABLE memori");
        msg.reply("🧠 Memori AI bersih.");
        return true;
    }

    if (command === '!resetfinance') {
        try {
            await db.query("TRUNCATE TABLE transaksi");
            msg.reply("💸 Data keuangan berhasil di-reset (0 Rupiah).");
        } catch (e) {
            msg.reply("❌ Gagal reset finance: " + e.message);
        }
        return true;
    }

    return false;
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Update Bot' },
        { command: '!forceupdate', desc: 'Paksa Update' },
        { command: '!restart', desc: 'Restart Bot' },
        { command: '!resetlogs', desc: 'Hapus Log' },
        { command: '!resetmemori', desc: 'Hapus Memori' },
        { command: '!resetfinance', desc: 'Hapus Keuangan' }
    ]
};