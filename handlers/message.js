const fs = require('fs');
const path = require('path');
const { observe } = require('../commands/ai');

// --- 1. LOAD COMMANDS OTOMATIS (Map System) ---
const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

console.log('🔄 Loading Commands...');
for (const file of commandFiles) {
    try {
        const module = require(`../commands/${file}`);
        if (module.metadata && module.metadata.commands) {
            module.metadata.commands.forEach(cmd => {
                // Support export function langsung atau object { interact }
                const handler = module.interact || module;
                commands.set(cmd.command, handler);
            });
        }
    } catch (e) {
        console.error(`❌ Gagal load ${file}:`, e.message);
    }
}
console.log(`✅ ${commands.size} Commands Siap!`);

const cooldowns = new Map();

module.exports = async (client, msg) => {
    try {
        // 🔥 FILTER DASAR 🔥
        // Abaikan pesan dari diri sendiri, status WA, notif enkripsi, log telepon
        if (msg.fromMe || msg.isStatus || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        const body = msg.body || "";
        const senderId = msg.author || msg.from; // Support Grup & Japri

        // 👇👇 INI LOGIKA PENTINGNYA 👇👇
        const isGroup = msg.from.includes('@g.us');

        // Ambil Nama User (Safe Mode)
        let namaPengirim = "User";
        try {
            const contact = await msg.getContact();
            namaPengirim = contact.pushname || contact.name || "User";
        } catch (e) { }

        // --- A. DETEKSI COMMAND (Manual pakai prefix ! atau /) ---
        // Command Manual TETAP JALAN di grup (misal: !ping, !menu)
        if (body.startsWith('!') || body.startsWith('/')) {
            const args = body.trim().split(/ +/);
            const commandName = args[0].toLowerCase();

            if (commands.has(commandName)) {
                // Rate Limiter (Anti Spam)
                if (cooldowns.has(senderId)) {
                    const expiration = cooldowns.get(senderId) + 1500;
                    if (Date.now() < expiration) return; // Silent ignore
                }

                const handler = commands.get(commandName);

                try {
                    // Execute Command
                    await handler(client, msg, args, senderId, namaPengirim, body);
                } catch (errCmd) {
                    console.error(`❌ Error Command ${commandName}:`, errCmd);
                }

                cooldowns.set(senderId, Date.now());
                setTimeout(() => cooldowns.delete(senderId), 1500);
                return;
            }
        }

        // --- B. DETEKSI LINK (AUTO DOWNLOADER) ---
        // 🛡️ FILTER ANTI SPAM GRUP 🛡️
        if (body.match(/(https?:\/\/[^\s]+)/g)) {

            // 🛑 KALAU DI GRUP -> STOP! JANGAN DOWNLOAD!
            if (isGroup) return;

            // Cek Link TikTok / FB
            const textLower = body.toLowerCase();
            if (textLower.includes('tiktok.com') || textLower.includes('facebook.com') || textLower.includes('fb.watch')) {
                // Panggil downloader manual lewat Map (metadata harus pas '(auto detect)')
                if (commands.has('(auto detect)')) {
                    await commands.get('(auto detect)')(client, msg, [], senderId, namaPengirim, body);
                    return;
                }
            }
        }

        // --- C. AI OBSERVER (MEMORY) ---
        // AI jangan nguping di grup (Privasi & Hemat DB)
        if (!body.startsWith('!') && !isGroup) {
            observe(client, msg, namaPengirim).catch(() => { });
        }

    } catch (error) {
        console.error("Handler Fatal Error:", error);
    }
};