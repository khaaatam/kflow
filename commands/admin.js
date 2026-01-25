module.exports = async (client, msg, text, db) => {
    // 1. CEK OTORITAS (Hanya Owner/Bot atau Nomor Log yang boleh)
    const isOwner = msg.fromMe || (config.system && msg.from === config.system.logNumber);

    // --- LIST COMMAND ADMIN DI BAWAH SINI ---

    // A. Command Reset Memori
    if (text === '!reset') {
        if (!isOwner) {
            await client.sendMessage(msg.from, "⛔ *AKSES DITOLAK*\nLu bukan admin, jangan macem-macem.");
            return true; // Return true biar bot gak lanjut proses ke file lain
        }

        db.query("TRUNCATE TABLE memori", (err) => {
            if (err) {
                client.sendMessage(msg.from, "❌ Gagal format otak: " + err.message);
            } else {
                client.sendMessage(msg.from, "🤯 *BRAIN WASHED!* Database memori berhasil dikosongkan.");
            }
        });
        return true; // Command handled
    }

    if (text === '!restart') {
        if (!isOwner) {
            await client.sendMessage(msg.from, "⛔ *AKSES DITOLAK*\nLu bukan admin, jangan macem-macem.");
            return;
        }

    }
    // Nanti kalau mau nambah command admin lain (misal !restart), taruh sini...

    return false; // Return false artinya chat ini bukan command admin
};

// TAMBAHAN METADATA MENU
module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!reset', desc: 'Reset Memori Otak AI (Admin Only)' }
    ]
};