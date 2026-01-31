const fs = require('fs');
const path = require('path');

module.exports = async (client, msg, args, senderId, namaPengirim) => {
    const command = args[0];

    // --- PING ---
    if (command === '!ping') {
        const start = Date.now();
        await client.sendMessage(msg.from, "Pong!");
        const latency = Date.now() - start;
        return client.sendMessage(msg.from, `📶 Latency: ${latency}ms`);
    }

    // --- CEK ID ---
    if (command === '!cekid') {
        return msg.reply(`🆔 ID: \`${senderId}\`\n👤 Nama: ${namaPengirim}`);
    }

    // --- MENU OTOMATIS ---
    if (command === '!menu' || command === '!help') {
        let menu = `🤖 *K-FLOW BOT MENU* 🤖\n_Halo ${namaPengirim}!_\n\n`;

        const commandFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js'));
        const categories = {};

        for (const file of commandFiles) {
            try {
                const cmdModule = require(path.join(__dirname, file));
                if (cmdModule.metadata) {
                    const { category, commands } = cmdModule.metadata;
                    if (!categories[category]) categories[category] = [];
                    commands.forEach(c => categories[category].push(`• *${c.command}*: ${c.desc}`));
                }
            } catch (e) { }
        }

        const icons = { 'KEUANGAN': '💰', 'AI': '🧠', 'DOWNLOADER': '📥', 'MEDIA': '🎬', 'SYSTEM': '⚙️', 'LAINNYA': '📂' };

        for (const [cat, cmds] of Object.entries(categories)) {
            const icon = icons[cat] || '📦';
            menu += `${icon} *${cat}*\n${cmds.join('\n')}\n\n`;
        }

        msg.reply(menu);
    }
};

module.exports.metadata = {
    category: "SYSTEM",
    commands: [
        { command: '!menu', desc: 'Daftar Menu' },
        { command: '!ping', desc: 'Cek Sinyal' },
        { command: '!cekid', desc: 'Cek ID User' }
    ]
};