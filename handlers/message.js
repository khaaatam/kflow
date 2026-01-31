const fs = require('fs');
const path = require('path');
const { observe } = require('../commands/ai');
const config = require('../config');
const db = require('../lib/database'); // 👈 WAJIB IMPORT DATABASE

// PRE-LOAD COMMANDS
const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

console.log('🔄 Loading Commands...');
for (const file of commandFiles) {
    try {
        const module = require(`../commands/${file}`);
        if (module.metadata && module.metadata.commands) {
            module.metadata.commands.forEach(cmd => {
                const handler = module.interact || module;
                commands.set(cmd.command, handler);
            });
        }
    } catch (e) { console.error(`Skip ${file}: ${e.message}`); }
}
console.log(`✅ ${commands.size} Commands Loaded!`);

const cooldowns = new Map();

module.exports = async (client, msg) => {
    try {
        // 🔥 1. FILTER DASAR (JANGAN BLOKIR 'fromMe' DISINI DULU)
        // Kita butuh chat 'fromMe' (chat lu sendiri) buat disimpan di DB sebagai bahan belajar AI.
        if (msg.isStatus || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        const body = msg.body || "";
        const senderId = msg.author || msg.from;
        const isGroup = msg.from.includes('@g.us');

        let namaPengirim = "User";
        try {
            const contact = await msg.getContact();
            namaPengirim = contact.pushname || contact.name || "User";
        } catch (e) { }

        // 🔥 2. AUTO-LOGGING (CATAT SEMUA CHAT KE DATABASE)
        // Ini kunci biar fitur !ayang dan !tami jalan
        try {
            await db.query(
                "INSERT INTO full_chat_logs (nama_pengirim, pesan, is_forwarded) VALUES (?, ?, ?)",
                [namaPengirim, body, msg.isForwarded ? 1 : 0]
            );
        } catch (err) {
            console.error("❌ Gagal Log Chat:", err.message);
        }

        // --- A. HANDLE COMMANDS (PRIORITAS UTAMA) ---
        if (body.startsWith('!') || body.startsWith('/')) {
            const args = body.trim().split(/ +/);
            const commandName = args[0].toLowerCase();

            if (commands.has(commandName)) {
                // Rate Limiter
                if (cooldowns.has(senderId)) {
                    const expiration = cooldowns.get(senderId) + 1500;
                    if (Date.now() < expiration) return;
                }

                const handler = commands.get(commandName);
                try {
                    await handler(client, msg, args, senderId, namaPengirim, body);
                } catch (e) {
                    console.error(`Command Error: ${e.message}`);
                }

                cooldowns.set(senderId, Date.now());
                setTimeout(() => cooldowns.delete(senderId), 1500);
                return; // ⛔ STOP, JANGAN LANJUT KE BAWAH
            }
        }

        // --- B. AUTO DOWNLOADER (LINK DETECTOR) ---
        if (body.match(/(https?:\/\/[^\s]+)/g)) {
            if (isGroup) return; // ⛔ JANGAN DOWNLOAD DI GRUP

            const textLower = body.toLowerCase();
            if (textLower.includes('tiktok.com') || textLower.includes('facebook.com') || textLower.includes('fb.watch')) {
                if (commands.has('(auto detect)')) {
                    await commands.get('(auto detect)')(client, msg, [], senderId, namaPengirim, body);
                    return;
                }
            }
        }

        // 🔥 3. FILTER AKHIR (ANTI-LOOP)
        // Kalau chat ini dari LU SENDIRI (msg.fromMe) dan bukan command, 
        // STOP DISINI. Jangan biarkan AI ngebales curhatan lu sendiri.
        if (msg.fromMe) return;

        // --- C. AI OBSERVER (BUAT REPLY CHAT ORANG LAIN) ---
        if (!body.startsWith('!') && !isGroup) {
            observe(client, msg, namaPengirim).catch(() => { });
        }

    } catch (error) {
        console.error("Handler Fatal Error:", error);
    }
};