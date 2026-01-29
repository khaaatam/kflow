const fs = require('fs');
const path = require('path');
const { observe, interact } = require('../commands/ai');

// PRE-LOAD COMMANDS
const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));

console.log('🔄 Loading Commands...');
for (const file of commandFiles) {
    const module = require(`../commands/${file}`);
    if (module.metadata && module.metadata.commands) {
        module.metadata.commands.forEach(cmd => {
            const handler = module.interact || module;
            commands.set(cmd.command, handler);
        });
    }
}
console.log(`✅ ${commands.size} Commands Loaded!`);

const cooldowns = new Map();

module.exports = async (client, msg) => {
    try {
        const body = msg.body;
        const senderId = msg.from;

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
                // Rate Limiter (Anti Spam)
                if (cooldowns.has(senderId)) {
                    const expiration = cooldowns.get(senderId) + 2000;
                    if (Date.now() < expiration) return;
                }

                const handler = commands.get(commandName);
                // Kita kirim 'body' asli juga (parameter terakhir) buat Regex Downloader
                await handler(client, msg, args, senderId, namaPengirim, body);

                cooldowns.set(senderId, Date.now());
                setTimeout(() => cooldowns.delete(senderId), 2000);
                return;
            }
        }

        // --- B. HANDLE OBSERVER ---
        if (!msg.isStatus) {
            observe(client, msg, namaPengirim).catch(err => console.error("Observer Error:", err));
        }

    } catch (error) {
        console.error("Handler Error:", error);
    }
};