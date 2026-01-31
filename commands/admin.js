const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK (SUPER ROBUST)
    
    // 1. Ambil Angkanya Doang dari Sender ID
    // Contoh: "62896...:12@c.us" -> "62896..."
    const cleanSender = String(senderId).replace(/[^0-9]/g, '');

    // 2. Ambil Angkanya Doang dari Config Owner
    // Jadi mau lu nulis pake @c.us atau enggak di config, tetep kebaca
    const cleanOwners = config.ownerNumber.map(id => String(id).replace(/[^0-9]/g, ''));

    // 3. Bandingkan
    if (!cleanOwners.includes(cleanSender)) {
        // Debugging (Biar lu tau kenapa ditolak)
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
                if (stderr && stderr.includes('Please commit your changes')) {
                    errorMsg = "⚠️ *ADA KONFLIK FILE!* \nKetik *!forceupdate* buat timpa editan manual lu.";
                }
                return msg.reply(errorMsg);
            }

            const output = stdout || stderr || "Done.";
            if (output.includes('Already up to date') && !isForce) {
                return msg.reply("✅ Bot sudah versi terbaru.");
            }

            let report = `✅ *UPDATE SUKSES*\n\`\`\`${output}\`\`\`\n`;

            if (output.includes('package.json')) {
                report += "\n📦 *Install Library Baru...*";
                await msg.reply(report);
                exec('npm install', () => {
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
        await db.query("TRUNCATE TABLE transaksi");
        msg.reply("💸 Data keuangan bersih.");
        return true;
    }

    return false;
};

// JANGAN LUPA METADATA DI BAWAH!
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