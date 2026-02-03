const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    const cleanSender = String(senderId).replace(/[^0-9]/g, '');
    const cleanOwners = config.ownerNumber.map(id => String(id).replace(/[^0-9]/g, ''));

    if (!cleanOwners.includes(cleanSender)) {
        console.log(`⛔ Access Denied: ${cleanSender} bukan Owner.`);
        return false;
    }

    const command = args[0].toLowerCase();

    const restartBot = async (pesanTambahan = "") => {
        exec('pm2 flush', async (err) => {
            if (err) console.error("Gagal flush logs:", err);
            
            await msg.reply(`${pesanTambahan}\n✨ *Logs Bersih.* Bot Restarting... ♻️`);
            
            setTimeout(() => process.exit(0), 2000);
        });
    };

    if (command === '!update' || command === '!forceupdate') {
        const isForce = command === '!forceupdate';
        const gitCmd = isForce
            ? 'git fetch --all && git reset --hard origin/main && git pull'
            : 'git pull';

        exec(gitCmd, async (err, stdout, stderr) => {
            if (err) {
                let errorMsg = `❌ Gagal: ${err.message}`;
                if (stderr && stderr.includes('Please commit')) {
                    errorMsg = "⚠️ *GAGAL: ADA KONFLIK!* \nKetik *!forceupdate* buat timpa editan manual lu.";
                }
                return msg.reply(errorMsg);
            }

            const output = stdout || stderr || "Done.";
            if (output.includes('Already up to date') && !isForce) {
                return msg.reply("✅ Bot sudah versi terbaru.");
            }

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

    if (command === '!restart') {
        await restartBot("🔄 Perintah Manual."); 
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