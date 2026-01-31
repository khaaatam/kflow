const fs = require('fs');
const path = require('path');
const { observe } = require('../commands/ai');
const config = require('../config');

// PRE-LOAD COMMANDS DENGAN PENGAMAN
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
    } catch (e) {
        // 👇 INI PENYELAMATNYA: Kalau ada error, cuma file itu yg diskip.
        console.error(`❌ Gagal load ${file}:`, e.message);
    }
}
console.log(`✅ ${commands.size} Commands Loaded!`);

const cooldowns = new Map();

module.exports = async (client, msg) => {
    try {
        // Filter Dasar (Anti Loop Bot Sendiri)
        // Kalau lu mau pake bot ini buat akun sendiri (Self-bot), hapus baris "msg.fromMe" di bawah ini.
        if (msg.isStatus || msg.type === 'e2e_notification' || msg.type === 'call_log') return;

        const body = msg.body || "";
        const senderId = msg.from; // ID Pengirim (Bisa Bot sendiri atau Orang lain)
        const isGroup = msg.from.includes('@g.us');

        let namaPengirim = "User";
        try {
            const contact = await msg.getContact();
            namaPengirim = contact.pushname || contact.name || "User";
        } catch (e) { }

        // --- A. HANDLE COMMANDS ---
        if (body.startsWith('!') || body.startsWith('/')) {
            const args = body.trim().split(/ +/);
            const commandName = args[0].toLowerCase();

            if (commands.has(commandName)) {
                if (cooldowns.has(senderId)) {
                    if (Date.now() < cooldowns.get(senderId) + 1500) return;
                }

                const handler = commands.get(commandName);
                try {
                    await handler(client, msg, args, senderId, namaPengirim, body);
                } catch (err) {
                    console.error(`Command ${commandName} Error:`, err.message);
                    msg.reply("❌ Error command.");
                }

                cooldowns.set(senderId, Date.now());
                return;
            }
        }

        // --- B. AUTO DOWNLOADER (SKIP GRUP) ---
        if (body.match(/(https?:\/\/[^\s]+)/g) && !isGroup) {
            const textLower = body.toLowerCase();
            if ((textLower.includes('tiktok') || textLower.includes('facebook') || textLower.includes('fb.watch')) && commands.has('(auto detect)')) {
                await commands.get('(auto detect)')(client, msg, [], senderId, namaPengirim, body);
                return;
            }
        }

        // --- C. OBSERVER ---
        // AI jangan bales command sendiri
        if (!body.startsWith('!') && !isGroup && !msg.fromMe) {
            observe(client, msg, namaPengirim).catch(() => { });
        }

    } catch (error) {
        console.error("Handler Fatal Error:", error);
    }
};