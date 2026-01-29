const { exec } = require('child_process');
const config = require('../config');
const db = require('../lib/database');

module.exports = async (client, msg, args, senderId) => {
    // 🛡️ SECURITY CHECK (SAFE MODE)
    const owners = config.ownerNumber || [];
    const isOwner = owners.includes(senderId.replace('@c.us', ''));

    if (!isOwner) return false; // Silent block

    const command = args[0];

    // --- 1. COMMAND: UPDATE SYSTEM (!update) ---
    if (command === '!update' || command === '!gitpull') {
        try { await msg.react('⏳'); } catch (e) { }

        exec('git pull', async (error, stdout, stderr) => {
            if (error) return msg.reply(`❌ Gagal Update:\n${error.message}`);
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

    // --- 2. COMMAND: RESET LOGS (!resetlogs) ---
    if (command === '!resetlogs') {
        try {
            await db.query("TRUNCATE TABLE full_chat_logs");
            msg.reply("✅ Logs chat bersih.");
        } catch (e) { msg.reply("❌ Gagal reset logs."); }
        return true;
    }

    // --- 3. COMMAND: RESET MEMORI (!resetmemori) ---
    if (command === '!resetmemori') {
        try {
            await db.query("TRUNCATE TABLE memori");
            msg.reply("🧠 Memori AI bersih.");
        } catch (e) { msg.reply("❌ Gagal reset memori."); }
        return true;
    }

    // --- 4. COMMAND: RESET FINANCE (!resetfinance) 👈 INI DIA
    if (command === '!resetfinance') {
        try {
            await db.query("TRUNCATE TABLE transaksi");
            msg.reply("💸 Data keuangan di-reset ke 0 (Dompet Kosong).");
        } catch (e) { msg.reply("❌ Gagal reset finance."); }
        return true;
    }

    // --- 5. COMMAND: RESTART (!restart) ---
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
        { command: '!update', desc: 'Git Pull' },
        { command: '!restart', desc: 'Restart Bot' },
        { command: '!resetlogs', desc: 'Hapus Chat Logs' },
        { command: '!resetmemori', desc: 'Hapus Ingatan AI' },
        { command: '!resetfinance', desc: 'Hapus Data Keuangan' }
    ]
};