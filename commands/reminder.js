const db = require('../lib/database');

module.exports = async (client, msg, args) => {
    const menit = parseInt(args[1]);
    const pesan = args.slice(2).join(' ');

    if (isNaN(menit) || !pesan) return msg.reply('Format: !ingetin [menit] [pesan]');

    // Simpan ke DB biar kalau restart gak ilang (Opsional, simpel dulu)
    // Di sini kita pake setTimeout biasa dulu sesuai request
    msg.reply(`Oke, diingetin ${menit} menit lagi.`);

    setTimeout(() => {
        client.sendMessage(msg.from, `⏰ *REMINDER*: ${pesan}`);
    }, menit * 60 * 1000);
};

// --- FUNGSI RESTORE (Biar app.js gak error) ---
// Walaupun logic DB-nya belum full, kita siapin wadahnya.
module.exports.restoreReminders = async (client, db) => {
    console.log("🔄 Cek Pending Reminders...");
    // Logic restore dari DB bisa ditaruh sini nanti
};

module.exports.metadata = {
    category: "LAINNYA",
    commands: [{ command: '!ingetin', desc: 'Set Reminder' }]
};