const fs = require('fs');
const path = require('path');
const { observe, interact } = require('../commands/ai'); // Import Observer manual

// --- 1. PRE-LOAD COMMANDS (Optimasi O(1)) ---
const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

console.log('🔄 Loading Commands...');
for (const file of commandFiles) {
    const module = require(`../commands/${file}`);
    if (module.metadata && module.metadata.commands) {
        module.metadata.commands.forEach(cmd => {
            // Map '!command' ke function module-nya
            // Kalau file export-nya object {interact}, ambil interact. Kalau function langsung, ambil function.
            const handler = module.interact || module;
            commands.set(cmd.command, handler);
        });
    }
}
console.log(`✅ ${commands.size} Commands Loaded!`);

// --- 2. RATE LIMITER ---
const cooldowns = new Map();

module.exports = async (client, msg) => {
    try {
        const body = msg.body;
        const senderId = msg.from;

        // Ambil info pengirim
        let namaPengirim = "User";
        try {
            const contact = await msg.getContact();
            namaPengirim = contact.pushname || contact.name || "User";
        } catch (e) { }

        // --- A. HANDLE COMMANDS ---
        if (body.startsWith('!') || body.startsWith('/')) {
            const args = body.split(' ');
            const commandName = args[0].toLowerCase();

            if (commands.has(commandName)) {
                // Cek Cooldown (3 detik)
                if (cooldowns.has(senderId)) {
                    const expiration = cooldowns.get(senderId) + 3000;
                    if (Date.now() < expiration) {
                        return msg.react('⏳'); // Kasih reaksi aja biar gak spam chat
                    }
                }

                // Execute Command
                const handler = commands.get(commandName);
                await handler(client, msg, args, senderId, namaPengirim);

                // Set Cooldown
                cooldowns.set(senderId, Date.now());
                setTimeout(() => cooldowns.delete(senderId), 3000);
                return;
            }
        }

        // --- B. HANDLE OBSERVER (PASSIVE) ---
        // Kalau bukan command, jalankan observer di background
        if (!msg.isStatus) { // Jangan observe status WA
            observe(client, msg, namaPengirim).catch(err => console.error("Observer Error:", err));
        }

    } catch (error) {
        console.error("Handler Error:", error);
    }
};