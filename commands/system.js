const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../lib/logger');

module.exports = async (client, msg, args, senderId, namaPengirim) => {
    const command = args[0];

    // --- PING ---
    if (command === '!ping') {
        const start = Date.now();
        await client.sendMessage(msg.from, 'Pong!');
        const latency = Date.now() - start;
        return client.sendMessage(msg.from, `📶 Latency: ${latency}ms`);
    }

    // --- CEK ID ---
    if (command === '!cekid') {
        const targetNumber = args[1];

        if (targetNumber) {
            try {
                let cleanNumber = targetNumber.replace(/[\s\-+]/g, '');
                if (cleanNumber.startsWith('0')) cleanNumber = '62' + cleanNumber.slice(1);

                const whatsappId = cleanNumber + '@c.us';
                const contact = await client.getContactById(whatsappId);

                if (contact) {
                    const isRegistered = contact.isRegistered !== false;
                    return msg.reply(
                        `📞 Nomor: ${cleanNumber}\n` +
                        `🆔 ID: \`${contact.id._serialized}\`\n` +
                        `📛 Nama: ${contact.pushname || '-'}\n` +
                        `${isRegistered ? '✅' : '❌'} ${isRegistered ? 'Terdaftar di WhatsApp' : 'Tidak terdaftar'}`
                    );
                } else {
                    return msg.reply(`❌ Nomor ${cleanNumber} tidak ditemukan.`);
                }
            } catch (e) {
                logger.error('CekID Error:', e.message || e);
                return msg.reply('❌ Gagal cek ID. Pastikan nomor valid.');
            }
        }

        return msg.reply(`🆔 ID: \`${senderId}\`\n👤 Nama: ${namaPengirim}`);
    }

    // --- OWNER ---
    if (command === '!owner') {
        let ownerId = config.ownerNumber[0];
        if (!ownerId.includes('@c.us')) ownerId += '@c.us';

        try {
            const contact = await client.getContactById(ownerId);
            await msg.reply(contact);
        } catch (e) {
            logger.error('Gagal kirim kontak:', e);
            await msg.reply(`👤 Owner: ${config.creator[0] || config.creator}\n📞 Wa: https://wa.me/${ownerId.split('@')[0]}`);
        }
        return true;
    }

    // --- MENU ---
    if (command === '!menu' || command === '!help') {
        const isGuest = namaPengirim === 'Guest';
        const commandFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.js'));
        const categories = {};

        const icons = {
            'KEUANGAN': '💰', 'AI': '🧠', 'DOWNLOADER': '📥',
            'MEDIA': '🎬', 'SYSTEM': '⚙️', 'LAINNYA': '📂', 'GROUP': '👥',
            'EVENT': '📅'
        };

        let totalCommands = 0;

        for (const file of commandFiles) {
            try {
                const cmdModule = require(path.join(__dirname, file));
                if (cmdModule.metadata) {
                    const { category, commands } = cmdModule.metadata;
                    if (!categories[category]) categories[category] = [];

                    commands.forEach(c => {
                        if (c.isPublic || !isGuest) {
                            categories[category].push(c);
                            totalCommands++;
                        }
                    });
                }
            } catch { /* skip unreadable */ }
        }

        let menu = `🤖 *${config.botName}*\n`;
        menu += `Halo ${namaPengirim}!\n`;
        menu += `─────────────────\n\n`;

        for (const [cat, cmds] of Object.entries(categories)) {
            if (cmds.length > 0) {
                const icon = icons[cat] || '📦';
                menu += `${icon} *${cat}*\n`;
                cmds.forEach(c => {
                    menu += `• *${c.command}* — ${c.desc}\n`;
                });
                menu += '\n';
            }
        }

        const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        menu += `_${totalCommands} command tersedia_\n`;
        menu += `🕒 ${time}`;

        await msg.reply(menu);
        return true;
    }
};

module.exports.metadata = {
    category: 'SYSTEM',
    commands: [
        { command: '!owner', desc: 'Kartu Nama Owner', isPublic: true },
        { command: '!menu', desc: 'Daftar Menu', isPublic: true },
        { command: '!ping', desc: 'Cek Sinyal', isPublic: true },
        { command: '!cekid', desc: 'Cek ID (sendiri/nomor)', isPublic: true }
    ]
};
