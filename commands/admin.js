const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK
    const cleanId = senderId.replace('@c.us', '');
    if (!config.ownerNumber.includes(cleanId)) return false; // Silent Block

    const command = args[0];

    // --- UPDATE SYSTEM ---
    if (command === '!update' || command === '!forceupdate') {
        const isForce = command === '!forceupdate';
        const gitCmd = isForce
            ? 'git fetch --all && git reset --hard origin/main && git pull'
            : 'git pull';

        await msg.reply(isForce ? "☢️ *FORCE UPDATING...*" : "⏳ *Checking Updates...*");

        exec(gitCmd, (err, stdout) => {
            if (err) return msg.reply(`❌ Gagal: ${err.message}`);
            if (stdout.includes('Already up to date') && !isForce) return msg.reply("✅ Bot sudah versi terbaru.");

            msg.reply(`✅ *UPDATE SUKSES*\n\`\`\`${stdout}\`\`\`\n\n♻️ Restarting...`);
            setTimeout(() => process.exit(0), 2000);
        });
        return true;
    }

    // --- RESET DATA ---
    if (command === '!resetlogs') {
        await db.query("TRUNCATE TABLE full_chat_logs");
        return msg.reply("✅ Chat logs dihapus.");
    }
    if (command === '!resetmemori') {
        await db.query("TRUNCATE TABLE memori");
        return msg.reply("🧠 Memori AI direset.");
    }
    if (command === '!resetfinance') {
        await db.query("TRUNCATE TABLE transaksi");
        return msg.reply("💸 Data keuangan direset.");
    }

    // --- RESTART ---
    if (command === '!restart') {
        await msg.reply("♻️ Restarting manually...");
        setTimeout(() => process.exit(0), 1000);
        return true;
    }
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!update', desc: 'Update Bot' },
        { command: '!forceupdate', desc: 'Paksa Update (Reset Local)' },
        { command: '!restart', desc: 'Restart Bot' },
        { command: '!resetfinance', desc: 'Hapus Data Keuangan' }
    ]
};