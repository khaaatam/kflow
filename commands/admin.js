const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');
const logger = require('../lib/logger');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK
    const cleanSender = String(senderId).replace(/[^0-9]/g, '');
    const cleanOwners = config.ownerNumber.map(id => String(id).replace(/[^0-9]/g, ''));

    if (!cleanOwners.includes(cleanSender)) {
        logger.warn(`Access Denied: ${cleanSender} bukan Owner.`);
        return false;
    }

    const command = args[0].toLowerCase();

    // 🔥 DEFINISI FUNGSI RESTART DI SINI (BIAR BISA DIPAKE SEMUA) 🔥
    const restartBot = async (pesanTambahan = "") => {
        // 1. Bersihkan Log Lama (PM2 Flush)
        exec('pm2 flush', async (err) => {
            if (err) logger.error("Gagal flush logs:", err);

            // 2. Tentukan Pesan: Kalau ada tambahan, baru kasih Enter (\n). Kalau gak, langsung aja.
            const finalText = pesanTambahan
                ? `${pesanTambahan}\n✨ *Logs Bersih.* Bot Restarting... ♻️`
                : `✨ *Logs Bersih.* Bot Restarting... ♻️`;

            // 3. Kirim ke WA
            await msg.reply(finalText);

            // 4. MATIIN BOT
            setTimeout(() => process.exit(0), 2000);
        });
    };

    // --- FITUR UPDATE ---
    if (command === '!update' || command === '!forceupdate') {
        const isForce = command === '!forceupdate';
        const gitCmd = isForce
            ? 'git fetch --all && git reset --hard origin/main && git pull'
            : 'git pull';

        await msg.reply(isForce ? "☢️ *FORCE UPDATING...*" : "⏳ *Mengecek Update...*");

        exec(gitCmd, async (err, stdout, stderr) => {
            // 1. HANDLE ERROR
            if (err) {
                let errorMsg = `❌ Gagal: ${err.message}`;
                if (stderr && stderr.includes('Please commit')) {
                    errorMsg = "⚠️ *GAGAL: ADA KONFLIK!* \nKetik *!forceupdate* buat timpa editan manual lu.";
                }
                return msg.reply(errorMsg);
            }

            // 2. CEK STATUS
            const output = stdout || stderr || "Done.";
            if (output.includes('Already up to date') && !isForce) {
                return msg.reply("✅ Bot sudah versi terbaru.");
            }

            // 3. PROSES UPDATE
            let report = `✅ *UPDATE SUKSES*\n\`\`\`${output}\`\`\`\n`;

            if (output.includes('package.json')) {
                report += "\n📦 *Ada Library Baru, Installing...*";
                await msg.reply(report);

                exec('npm install', (errInstall) => {
                    if (errInstall) {
                        client.sendMessage(msg.from, "❌ Gagal npm install, coba manual.");
                    } else {
                        restartBot("✅ *Install Library Selesai!*");
                    }
                });
            } else {
                await msg.reply(report);
                restartBot();
            }
        });
        return true;
    }

    // --- SYSTEM UTILS ---
    if (command === '!restart') {
        // SEKARANG DIA UDAH KENAL SAMA FUNGSI INI ✅
        await restartBot("🔄 Perintah Manual.");
        return true;
    }

    if (command === '!resetlogs') {
        await db.query("TRUNCATE TABLE full_chat_logs");
        await msg.reply("✅ Chat logs bersih.");
        return true;
    }

    if (command === '!resetmemori') {
        await db.query("TRUNCATE TABLE memori");
        await msg.reply("🧠 Memori AI bersih.");
        return true;
    }

    if (command === '!resetfinance') {
        try {
            await db.query("TRUNCATE TABLE transaksi");
            await msg.reply("💸 Data keuangan berhasil di-reset (0 Rupiah).");
        } catch (e) {
            await msg.reply("❌ Gagal reset finance: " + e.message);
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